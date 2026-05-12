using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechList.Application.CvEvaluation.Interfaces;
using TechList.Application.CvEvaluation.Models;
using TechList.Application.Profiles.Interfaces;
using TechList.Domain.Entities;
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
        _db        = db;
        _cvStorage = cvStorage;
        _http      = httpClientFactory.CreateClient();
        _settings  = settings.Value;
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

        // Trả về kết quả đã lưu nếu có
        var existing = await _db.CvEvaluationRecords
            .FirstOrDefaultAsync(r => r.ApplicationId == applicationId, ct);
        if (existing is not null)
            return ToResult(existing);



        var candidateProfile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == application.CandidateId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy hồ sơ ứng viên.");

        if (string.IsNullOrWhiteSpace(candidateProfile.CvPublicId))
            throw new InvalidOperationException("Ứng viên chưa có CV.");

        var cvText  = await ExtractCvTextAsync(candidateProfile.CvPublicId, ct);
        var jobPost = application.JobPost;

        var prompt = BuildPrompt(jobPost.Title, jobPost.Requirements, jobPost.Description,
            candidateProfile.Skills, candidateProfile.Experience, candidateProfile.Education,
            application.CoverLetter, cvText);

        var json   = await CallGeminiAsync(prompt, ct);
        var result = ParseResult(json);

        // Lưu vào DB
        _db.CvEvaluationRecords.Add(new CvEvaluationRecord
        {
            ApplicationId  = applicationId,
            Score          = result.Score,
            Summary        = result.Summary,
            Strengths      = JsonSerializer.Serialize(result.Strengths),
            Weaknesses     = JsonSerializer.Serialize(result.Weaknesses),
            Recommendation = result.Recommendation,
            Details        = result.Details,
            CreatedAt      = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return result;
    }

    private static CvEvaluationResult ToResult(CvEvaluationRecord r) => new(
        r.Score,
        r.Summary,
        JsonSerializer.Deserialize<List<string>>(r.Strengths)  ?? [],
        JsonSerializer.Deserialize<List<string>>(r.Weaknesses) ?? [],
        r.Recommendation,
        r.Details
    );

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
            ## TIN TUYỂN DỤNG
            Vị trí: {{jobTitle}}

            Yêu cầu tuyển dụng:
            {{requirements}}

            Mô tả công việc:
            {{jobDescription}}

            ---

            ## CV ỨNG VIÊN (trích xuất từ PDF)
            {{(cvText.Trim().Length > 50 ? cvText : "[CV không đọc được hoặc để trống]")}}

            ## THÔNG TIN HỒ SƠ BỔ SUNG
            Kỹ năng: {{skills ?? "Không có"}}
            Kinh nghiệm: {{experience ?? "Không có"}}
            Học vấn: {{education ?? "Không có"}}
            Thư giới thiệu: {{coverLetter ?? "Không có"}}

            ---

            ## NHIỆM VỤ
            Đối chiếu từng yêu cầu tuyển dụng với nội dung CV ứng viên:
            - "strengths": liệt kê các yêu cầu mà CV ứng viên RÕ RÀNG đáp ứng được (trích dẫn bằng chứng từ CV)
            - "weaknesses": liệt kê các yêu cầu mà CV ứng viên CHƯA đáp ứng hoặc không đề cập
            - "score": tỷ lệ % yêu cầu được đáp ứng (0-100), không làm tròn quá cao nếu CV thiếu nhiều yêu cầu quan trọng
            - "recommendation": dựa vào score — ≥70: "Nên phỏng vấn", 40-69: "Cân nhắc thêm", <40: "Không phù hợp"
            - "summary": 1-2 câu nhận xét tổng quan về mức độ phù hợp
            - "details": 3-5 câu phân tích cụ thể: kỹ năng khớp/thiếu, kinh nghiệm có đủ không, học vấn phù hợp không

            Chỉ trả về JSON hợp lệ, không thêm text nào khác:
            {
              "score": <0-100>,
              "summary": "<string>",
              "strengths": ["<yêu cầu ứng viên đáp ứng>", ...],
              "weaknesses": ["<yêu cầu ứng viên chưa đáp ứng>", ...],
              "recommendation": "<Nên phỏng vấn | Cân nhắc thêm | Không phù hợp>",
              "details": "<string>"
            }
            """;
    }

    private async Task<string> CallGeminiAsync(string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            model       = _settings.Model,
            messages    = new[]
            {
                new { role = "system", content = "Bạn là chuyên gia tuyển dụng IT. Nhiệm vụ duy nhất: đối chiếu CV ứng viên với yêu cầu công việc và trả về JSON. Không giải thích, không thêm text ngoài JSON." },
                new { role = "user",   content = prompt }
            },
            max_tokens       = 1024,
            temperature      = 0,
            response_format  = new { type = "json_object" }
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

    // Đọc giá trị an toàn bất kể model trả về string, array hay object
    private static string ReadAsString(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString() ?? "",
        JsonValueKind.Array  => string.Join(" ", el.EnumerateArray().Select(x => ReadAsString(x))),
        _                    => el.ToString()
    };

    private static List<string> ReadAsStringList(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Array)
            return el.EnumerateArray().Select(x => ReadAsString(x)).Where(x => x.Length > 0).ToList();
        var single = ReadAsString(el);
        return single.Length > 0 ? [single] : [];
    }

    private static CvEvaluationResult ParseResult(string json)
    {
        var start = json.IndexOf('{');
        var end   = json.LastIndexOf('}');
        if (start >= 0 && end > start)
            json = json[start..(end + 1)];

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var score          = root.TryGetProperty("score", out var s) ? s.GetInt32() : 0;
        var summary        = root.TryGetProperty("summary",        out var su) ? ReadAsString(su) : "";
        var recommendation = root.TryGetProperty("recommendation", out var r)  ? ReadAsString(r)  : "";
        var details        = root.TryGetProperty("details",        out var d)  ? ReadAsString(d)  : "";
        var strengths      = root.TryGetProperty("strengths",      out var str) ? ReadAsStringList(str) : [];
        var weaknesses     = root.TryGetProperty("weaknesses",     out var wk)  ? ReadAsStringList(wk)  : [];

        return new CvEvaluationResult(score, summary, strengths, weaknesses, recommendation, details);
    }
}
