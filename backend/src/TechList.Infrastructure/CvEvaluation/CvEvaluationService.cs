using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechList.Application.CvEvaluation.Interfaces;
using TechList.Application.CvEvaluation.Models;
using TechList.Application.Profiles.Interfaces;
using TechList.Infrastructure.Options;
using TechList.Infrastructure.Persistence;
using UglyToad.PdfPig;

namespace TechList.Infrastructure.CvEvaluation;

public sealed class CvEvaluationService : ICvEvaluationService
{
    private readonly AppDbContext _db;
    private readonly ICvStorageService _cvStorage;
    private readonly HttpClient _http;
    private readonly AnthropicSettings _settings;

    public CvEvaluationService(
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

    public async Task<CvEvaluationResult> EvaluateCvAsync(Guid applicationId, string recruiterId, CancellationToken ct)
    {
        var application = await _db.JobApplications
            .Include(a => a.JobPost)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        var recruiterCompany = await _db.Companies
            .FirstOrDefaultAsync(c => c.OwnerId == recruiterId, ct)
            ?? throw new UnauthorizedAccessException("Không tìm thấy công ty.");

        if (application.JobPost.CompanyId != recruiterCompany.Id)
            throw new UnauthorizedAccessException("Bạn không có quyền đánh giá đơn này.");

        var candidateProfile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == application.CandidateId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy hồ sơ ứng viên.");

        if (string.IsNullOrWhiteSpace(candidateProfile.CvPublicId))
            throw new InvalidOperationException("Ứng viên chưa có CV.");

        var cvText = await ExtractCvTextAsync(candidateProfile.CvPublicId, ct);
        var jobPost = application.JobPost;

        var prompt = BuildPrompt(jobPost.Title, jobPost.Requirements, jobPost.Description,
            candidateProfile.Skills, candidateProfile.Experience, candidateProfile.Education,
            application.CoverLetter, cvText);

        var json = await CallGeminiAsync(prompt, ct);
        return ParseResult(json);
    }

    private async Task<string> ExtractCvTextAsync(string cvPublicId, CancellationToken ct)
    {
        var signedUrl = _cvStorage.GetSignedViewUrl(cvPublicId);

        var response = await _http.GetAsync(signedUrl, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var pdf = PdfDocument.Open(stream);

        var sb = new StringBuilder();
        foreach (var page in pdf.GetPages())
            sb.AppendLine(page.Text);

        return sb.ToString();
    }

    private static string BuildPrompt(
        string jobTitle, string requirements, string jobDescription,
        string? skills, string? experience, string? education,
        string? coverLetter, string cvText)
    {
        return $$"""
            Bạn là chuyên gia HR với kinh nghiệm đánh giá CV. Hãy phân tích CV của ứng viên so với yêu cầu công việc và trả về kết quả dưới dạng JSON.

            ## VỊ TRÍ TUYỂN DỤNG
            Tiêu đề: {{jobTitle}}

            Mô tả công việc:
            {{jobDescription}}

            Yêu cầu tuyển dụng:
            {{requirements}}

            ## HỒ SƠ ỨNG VIÊN (dữ liệu có cấu trúc)
            Kỹ năng (JSON): {{skills ?? "Chưa cập nhật"}}
            Kinh nghiệm (JSON): {{experience ?? "Chưa cập nhật"}}
            Học vấn (JSON): {{education ?? "Chưa cập nhật"}}
            Thư giới thiệu: {{coverLetter ?? "Không có"}}

            ## NỘI DUNG CV (trích xuất từ PDF)
            {{cvText}}

            ## YÊU CẦU
            Phân tích và trả về JSON hợp lệ (không có text nào bên ngoài JSON) theo đúng cấu trúc sau:
            {
              "score": <số nguyên 0-100 thể hiện mức độ phù hợp>,
              "summary": "<tóm tắt ngắn gọn 1-2 câu về ứng viên>",
              "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>", "<điểm mạnh 3>"],
              "weaknesses": ["<điểm yếu 1>", "<điểm yếu 2>"],
              "recommendation": "<'Nên phỏng vấn' hoặc 'Cân nhắc thêm' hoặc 'Không phù hợp'>",
              "details": "<phân tích chi tiết 3-5 câu về sự phù hợp giữa CV và yêu cầu công việc>"
            }
            """;
    }

    private async Task<string> CallGeminiAsync(string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            model    = _settings.Model,
            messages = new[] { new { role = "user", content = prompt } },
            max_tokens = 1024
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        request.Headers.Add("Authorization", $"Bearer {_settings.ApiKey}");
        request.Content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json");

        var response = await _http.SendAsync(request, ct);
        var body     = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Groq API lỗi: {response.StatusCode} - {body}");

        using var doc = JsonDocument.Parse(body);
        var text = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? throw new InvalidOperationException("Phản hồi từ Groq rỗng.");

        return text;
    }

    private static CvEvaluationResult ParseResult(string json)
    {
        // Tìm JSON block trong trường hợp Claude trả về text kèm JSON
        var start = json.IndexOf('{');
        var end   = json.LastIndexOf('}');
        if (start >= 0 && end > start)
            json = json[start..(end + 1)];

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var score          = root.TryGetProperty("score", out var s) ? s.GetInt32() : 0;
        var summary        = root.TryGetProperty("summary", out var su) ? su.GetString() ?? "" : "";
        var recommendation = root.TryGetProperty("recommendation", out var r) ? r.GetString() ?? "" : "";
        var details        = root.TryGetProperty("details", out var d) ? d.GetString() ?? "" : "";

        var strengths = root.TryGetProperty("strengths", out var str)
            ? str.EnumerateArray().Select(x => x.GetString() ?? "").ToList()
            : [];

        var weaknesses = root.TryGetProperty("weaknesses", out var wk)
            ? wk.EnumerateArray().Select(x => x.GetString() ?? "").ToList()
            : [];

        return new CvEvaluationResult(score, summary, strengths, weaknesses, recommendation, details);
    }
}
