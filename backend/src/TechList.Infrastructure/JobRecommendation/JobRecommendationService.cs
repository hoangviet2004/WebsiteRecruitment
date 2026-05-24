using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechList.Application.JobRecommendation.Interfaces;
using TechList.Application.JobRecommendation.Models;
using TechList.Application.Profiles.Interfaces;
using TechList.Infrastructure.Options;
using TechList.Infrastructure.Persistence;
using UglyToad.PdfPig;

namespace TechList.Infrastructure.JobRecommendation;

public sealed class JobRecommendationService : IJobRecommendationService
{
    private readonly AppDbContext _db;
    private readonly ICvStorageService _cvStorage;
    private readonly HttpClient _http;
    private readonly AnthropicSettings _settings;

    public JobRecommendationService(
        AppDbContext db,
        ICvStorageService cvStorage,
        IHttpClientFactory httpClientFactory,
        IOptions<AnthropicSettings> settings)
    {
        _db       = db;
        _cvStorage = cvStorage;
        _http     = httpClientFactory.CreateClient();
        _settings = settings.Value;
    }

    public async Task<JobRecommendationResult> RecommendAsync(string candidateId, CancellationToken ct)
    {
        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == candidateId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy hồ sơ ứng viên.");

        var cvText = string.Empty;
        if (!string.IsNullOrWhiteSpace(profile.CvPublicId))
        {
            try { cvText = await ExtractCvTextAsync(profile.CvPublicId, ct); }
            catch { cvText = string.Empty; }
        }

        // Nếu không có thông tin gì → không gợi ý
        var hasProfile = !string.IsNullOrWhiteSpace(profile.Skills)
                      || !string.IsNullOrWhiteSpace(profile.Experience)
                      || !string.IsNullOrWhiteSpace(profile.Education);
        if (cvText.Length < 50 && !hasProfile)
            return new JobRecommendationResult([]);

        var jobs = await _db.JobPosts
            .Include(j => j.Company)
            .Where(j => j.IsActive && j.IsApproved && !j.IsBlocked && j.ExpiresAt > DateTime.UtcNow
                     && j.Requirements != null && j.Requirements.Length >= 30)   // ← chỉ lấy job có yêu cầu đủ nội dung
            .OrderByDescending(j => j.CreatedAt)
            .Take(20)
            .ToListAsync(ct);

        if (jobs.Count == 0)
            return new JobRecommendationResult([]);

        // Format compact 1 dòng/job để tiết kiệm token
        var jobList = string.Join("\n", jobs.Select(j =>
        {
            var req = j.Requirements.Length > 120 ? j.Requirements[..120] : j.Requirements;
            // Làm sạch ký tự xuống dòng trong requirements để giữ 1 dòng/job
            req = req.Replace("\n", " ").Replace("\r", " ");
            var exp = j.Experience ?? "-";
            return $"{j.Id}|{j.Title}|{j.Company.Name}|{exp}|{req}";
        }));

        var prompt = BuildPrompt(cvText, profile.Skills, profile.Experience, profile.Education, jobList);
        var json   = await CallGeminiAsync(prompt, ct);
        return ParseResult(json);
    }

    private async Task<string> ExtractCvTextAsync(string cvPublicId, CancellationToken ct)
    {
        var signedUrl = _cvStorage.GetSignedViewUrl(cvPublicId);
        var response  = await _http.GetAsync(signedUrl, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var pdf = PdfDocument.Open(stream);

        var sb = new StringBuilder();
        foreach (var page in pdf.GetPages())
            sb.AppendLine(page.Text);

        var text = sb.ToString().Trim();
        // Giới hạn 800 ký tự — phần đầu CV chứa thông tin quan trọng nhất
        return text.Length > 800 ? text[..800] : text;
    }

    private static string BuildPrompt(
        string cvText, string? skills, string? experience, string? education, string jobList)
    {
        var cv = cvText.Length > 50 ? cvText : "(trống)";

        return $$"""
            CANDIDATE:
            CV: {{cv}}
            Skills: {{skills ?? "-"}}
            Experience: {{experience ?? "-"}}
            Education: {{education ?? "-"}}

            JOBS (format: ID|Title|Company|RequiredExp|Requirements):
            {{jobList}}

            TASK: Match candidate to jobs. Score each job 0-100 based on skills(50%), experience(30%), education(20%).
            Rules: only include score>=40, max 5 results, sort descending. Return empty array if no match.
            Output JSON only:
            {"recommendations":[{"jobId":"<uuid>","score":<40-100>,"reason":"<one sentence in Vietnamese explaining the match>"}]}
            """;
    }

    private async Task<string> CallGeminiAsync(string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = "Bạn là hệ thống gợi ý việc làm AI. Chỉ trả về JSON hợp lệ, không thêm text nào khác." } }
            },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = prompt } }
                }
            },
            generationConfig = new
            {
                temperature = 0,
                responseMimeType = "application/json"
            }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_settings.Model}:generateContent?key={_settings.ApiKey}";

        const int maxAttempts = 3;
        var delay = TimeSpan.FromSeconds(1.5);

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            attemptCts.CancelAfter(TimeSpan.FromSeconds(25)); // 25s timeout limit for this attempt

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

                var response = await _http.SendAsync(request, attemptCts.Token);
                var body     = await response.Content.ReadAsStringAsync(attemptCts.Token);

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(body);
                    return doc.RootElement
                        .GetProperty("candidates")[0]
                        .GetProperty("content")
                        .GetProperty("parts")[0]
                        .GetProperty("text")
                        .GetString() ?? throw new InvalidOperationException("Phản hồi Gemini rỗng.");
                }

                var statusCode = (int)response.StatusCode;
                var isRetryable = statusCode == 429 || statusCode >= 500 || statusCode == 408;

                if (isRetryable && attempt < maxAttempts)
                {
                    await Task.Delay(delay, ct);
                    delay = TimeSpan.FromSeconds(delay.TotalSeconds * 2);
                    continue;
                }

                throw new InvalidOperationException($"Gemini API lỗi: {response.StatusCode} - {body}");
            }
            catch (Exception ex) when (attempt < maxAttempts && !(ex is OperationCanceledException && ct.IsCancellationRequested))
            {
                // Network errors, timeouts, or transient exceptions - retry if user didn't cancel the main request
                await Task.Delay(delay, ct);
                delay = TimeSpan.FromSeconds(delay.TotalSeconds * 2);
            }
        }

        throw new InvalidOperationException("Không thể gọi Gemini API sau nhiều lần thử.");
    }

    private static JobRecommendationResult ParseResult(string json)
    {
        var start = json.IndexOf('{');
        var end   = json.LastIndexOf('}');
        if (start >= 0 && end > start) json = json[start..(end + 1)];

        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("recommendations", out var arr) ||
            arr.ValueKind != JsonValueKind.Array)
            return new JobRecommendationResult([]);

        var items = arr.EnumerateArray()
            .Select(el =>
            {
                var idStr  = el.TryGetProperty("jobId",  out var jid) ? jid.GetString() ?? "" : "";
                var score  = el.TryGetProperty("score",  out var sc)  ? sc.GetInt32()          : 0;
                var reason = el.TryGetProperty("reason", out var rs)  ? rs.GetString() ?? ""   : "";
                return Guid.TryParse(idStr, out var id)
                    ? new JobRecommendationItem(id, score, reason)
                    : null;
            })
            .Where(x => x is not null && x.Score >= 40)   // ← bỏ mọi kết quả AI trả về dưới ngưỡng
            .Cast<JobRecommendationItem>()
            .OrderByDescending(x => x.Score)
            .Take(5)
            .ToList();

        return new JobRecommendationResult(items);
    }
}
