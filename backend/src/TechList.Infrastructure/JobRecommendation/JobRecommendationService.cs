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

        // Format chi tiết từng job để AI so sánh được chính xác
        var jobList = string.Join("\n\n", jobs.Select((j, i) =>
        {
            var req = j.Requirements.Length > 300 ? j.Requirements[..300] : j.Requirements;
            return $"[{i + 1}]\nID: {j.Id}\nVị trí: {j.Title} — {j.Company.Name}\n"
                 + $"Kinh nghiệm yêu cầu: {j.Experience ?? "Không yêu cầu cụ thể"}\n"
                 + $"Học vấn yêu cầu: {j.Education ?? "Không yêu cầu cụ thể"}\n"
                 + $"Yêu cầu: {req}";
        }));

        var prompt = BuildPrompt(cvText, profile.Skills, profile.Experience, profile.Education, jobList);
        var json   = await CallGroqAsync(prompt, ct);
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
        return text.Length > 6000 ? text[..6000] : text;
    }

    private static string BuildPrompt(
        string cvText, string? skills, string? experience, string? education, string jobList)
    {
        var cvSection = cvText.Length > 50 ? cvText : "(Không có CV — chỉ dùng thông tin hồ sơ bên dưới)";

        return $$"""
            Bạn là hệ thống gợi ý việc làm. Hãy phân tích hồ sơ ứng viên và so sánh với từng vị trí tuyển dụng để tìm ra các vị trí PHÙ HỢP NHẤT.

            ═══ HỒ SƠ ỨNG VIÊN ═══
            NỘI DUNG CV:
            {{cvSection}}

            KỸ NĂNG (từ hồ sơ): {{skills ?? "Không có"}}
            KINH NGHIỆM (từ hồ sơ): {{experience ?? "Không có"}}
            HỌC VẤN (từ hồ sơ): {{education ?? "Không có"}}

            ═══ DANH SÁCH VIỆC LÀM ═══
            {{jobList}}

            ═══ HƯỚNG DẪN CHẤM ĐIỂM ═══
            Với MỖI vị trí, hãy đối chiếu cụ thể:
            1. Kỹ năng trong CV/hồ sơ có khớp với yêu cầu kỹ năng không? (trọng số 50%)
            2. Số năm kinh nghiệm có đáp ứng không? (trọng số 30%)
            3. Học vấn có phù hợp không? (trọng số 20%)

            Quy tắc điểm:
            - Chỉ chọn vị trí có điểm >= 40
            - Không gợi ý vị trí khi không có bằng chứng rõ ràng từ CV/hồ sơ
            - Nếu không có vị trí nào đủ điều kiện thì trả về recommendations rỗng []
            - Tối đa 5 vị trí, sắp xếp từ cao xuống thấp

            Chỉ trả về JSON hợp lệ, không thêm text nào khác:
            {
              "recommendations": [
                {
                  "jobId": "<UUID của job trong danh sách>",
                  "score": <40-100>,
                  "reason": "<1 câu cụ thể: nêu rõ kỹ năng/kinh nghiệm nào trong hồ sơ khớp với yêu cầu job>"
                }
              ]
            }
            """;
    }

    private async Task<string> CallGroqAsync(string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            model           = _settings.Model,
            messages        = new[]
            {
                new { role = "system", content = "Bạn là hệ thống gợi ý việc làm AI. Chỉ trả về JSON hợp lệ, không thêm text nào khác." },
                new { role = "user",   content = prompt }
            },
            max_tokens      = 1024,
            temperature     = 0,
            response_format = new { type = "json_object" }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        request.Headers.Add("Authorization", $"Bearer {_settings.ApiKey}");
        request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await _http.SendAsync(request, ct);
        var body     = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Groq API lỗi: {response.StatusCode} - {body}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? throw new InvalidOperationException("Phản hồi Groq rỗng.");
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
