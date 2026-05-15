using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;
using TechList.Application.Email;
using TechList.Infrastructure.Options;

namespace TechList.Infrastructure.Email;

public sealed class EmailService : IEmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }

    public async Task SendApplicationStatusEmailAsync(
        string toEmail,
        string candidateName,
        string jobTitle,
        string companyName,
        string newStatus,
        CancellationToken ct = default)
    {
        var (subject, htmlBody) = BuildContent(candidateName, jobTitle, companyName, newStatus);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls, ct);
        await smtp.AuthenticateAsync(_settings.Username, _settings.Password, ct);
        await smtp.SendAsync(message, ct);
        await smtp.DisconnectAsync(true, ct);
    }

    public async Task SendInterviewScheduledEmailAsync(
        string toEmail,
        string candidateName,
        string jobTitle,
        string companyName,
        DateTime scheduledAt,
        int durationMinutes,
        string? meetingLink,
        string? location,
        string? notes,
        CancellationToken ct = default)
    {
        var localTime = scheduledAt.ToLocalTime();
        var dateStr   = localTime.ToString("HH:mm, dddd, dd/MM/yyyy");

        var locationRow = !string.IsNullOrWhiteSpace(meetingLink)
            ? $"<tr><td style='padding:6px 0;color:#64748b;font-size:13px;width:120px'>Link phỏng vấn</td><td style='padding:6px 0;font-size:13px'><a href='{meetingLink}' style='color:#3b82f6'>{meetingLink}</a></td></tr>"
            : !string.IsNullOrWhiteSpace(location)
                ? $"<tr><td style='padding:6px 0;color:#64748b;font-size:13px;width:120px'>Địa điểm</td><td style='padding:6px 0;font-size:13px'>{location}</td></tr>"
                : "";

        var notesRow = !string.IsNullOrWhiteSpace(notes)
            ? $"<tr><td style='padding:6px 0;color:#64748b;font-size:13px;width:120px'>Ghi chú</td><td style='padding:6px 0;font-size:13px'>{notes}</td></tr>"
            : "";

        var html = $"""
            <!DOCTYPE html>
            <html lang="vi">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                    <tr>
                      <td style="background:#8b5cf6;padding:32px 40px;text-align:center;">
                        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">TechList</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Xin chào <strong>{candidateName}</strong>,</p>
                        <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:700;">Bạn có lịch phỏng vấn mới!</h2>
                        <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">
                          <strong>{companyName}</strong> đã lên lịch phỏng vấn cho vị trí <strong>{jobTitle}</strong>. Vui lòng sắp xếp thời gian tham gia đúng giờ.
                        </p>
                        <div style="border-left:4px solid #8b5cf6;padding:16px 20px;background:#f8fafc;border-radius:0 8px 8px 0;margin-bottom:24px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr><td style='padding:6px 0;color:#64748b;font-size:13px;width:120px'>Vị trí</td><td style='padding:6px 0;font-size:13px;font-weight:600;color:#0f172a'>{jobTitle}</td></tr>
                            <tr><td style='padding:6px 0;color:#64748b;font-size:13px'>Công ty</td><td style='padding:6px 0;font-size:13px'>{companyName}</td></tr>
                            <tr><td style='padding:6px 0;color:#64748b;font-size:13px'>Thời gian</td><td style='padding:6px 0;font-size:13px;font-weight:600;color:#8b5cf6'>{dateStr}</td></tr>
                            <tr><td style='padding:6px 0;color:#64748b;font-size:13px'>Thời lượng</td><td style='padding:6px 0;font-size:13px'>{durationMinutes} phút</td></tr>
                            {locationRow}
                            {notesRow}
                          </table>
                        </div>
                        <p style="margin:0;color:#94a3b8;font-size:13px;">Trân trọng,<br><strong>Đội ngũ TechList</strong></p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                        <p style="margin:0;color:#94a3b8;font-size:12px;">© 2025 TechList. Email này được gửi tự động, vui lòng không trả lời.</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"Lịch phỏng vấn: {jobTitle} tại {companyName}";
        message.Body = new TextPart("html") { Text = html };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls, ct);
        await smtp.AuthenticateAsync(_settings.Username, _settings.Password, ct);
        await smtp.SendAsync(message, ct);
        await smtp.DisconnectAsync(true, ct);
    }

    private static (string subject, string body) BuildContent(
        string candidateName, string jobTitle, string companyName, string status)
    {
        var (subject, headline, detail, color) = status switch
        {
            "Screening" => (
                $"Hồ sơ của bạn đang được xem xét — {jobTitle}",
                "Hồ sơ của bạn đang được xem xét",
                $"Chúng tôi đã nhận được hồ sơ ứng tuyển của bạn cho vị trí <strong>{jobTitle}</strong> tại <strong>{companyName}</strong> và đang tiến hành xem xét. Chúng tôi sẽ liên hệ lại trong thời gian sớm nhất.",
                "#3b82f6"
            ),
            "Interview" => (
                $"Bạn được mời phỏng vấn — {jobTitle}",
                "Chúc mừng! Bạn được mời phỏng vấn",
                $"Sau khi xem xét hồ sơ, chúng tôi rất vui được mời bạn tham gia buổi phỏng vấn cho vị trí <strong>{jobTitle}</strong> tại <strong>{companyName}</strong>. Nhà tuyển dụng sẽ liên hệ để sắp xếp lịch cụ thể.",
                "#8b5cf6"
            ),
            "Offered" => (
                $"Chúc mừng! Bạn nhận được Offer — {jobTitle}",
                "Bạn đã được chấp nhận!",
                $"Chúng tôi vô cùng vui mừng thông báo rằng bạn đã vượt qua tất cả các vòng tuyển dụng và được nhận vào vị trí <strong>{jobTitle}</strong> tại <strong>{companyName}</strong>. Nhà tuyển dụng sẽ liên hệ để thảo luận về các điều khoản hợp đồng.",
                "#10b981"
            ),
            "Rejected" => (
                $"Thông báo kết quả ứng tuyển — {jobTitle}",
                "Cảm ơn bạn đã ứng tuyển",
                $"Sau khi cân nhắc kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn cho vị trí <strong>{jobTitle}</strong> tại <strong>{companyName}</strong> chưa phù hợp với yêu cầu hiện tại. Chúng tôi trân trọng sự quan tâm của bạn và mong có cơ hội hợp tác trong tương lai.",
                "#ef4444"
            ),
            _ => (
                $"Cập nhật trạng thái ứng tuyển — {jobTitle}",
                "Trạng thái ứng tuyển đã được cập nhật",
                $"Trạng thái hồ sơ ứng tuyển của bạn cho vị trí <strong>{jobTitle}</strong> tại <strong>{companyName}</strong> đã được cập nhật.",
                "#64748b"
            )
        };

        var html = $"""
            <!DOCTYPE html>
            <html lang="vi">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                    <tr>
                      <td style="background:{color};padding:32px 40px;text-align:center;">
                        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">TechList</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Xin chào <strong>{candidateName}</strong>,</p>
                        <h2 style="margin:0 0 20px;color:#0f172a;font-size:20px;font-weight:700;">{headline}</h2>
                        <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">{detail}</p>
                        <div style="border-left:4px solid {color};padding:12px 16px;background:#f8fafc;border-radius:0 8px 8px 0;margin-bottom:24px;">
                          <p style="margin:0;color:#64748b;font-size:13px;">Vị trí ứng tuyển</p>
                          <p style="margin:4px 0 0;color:#0f172a;font-size:15px;font-weight:600;">{jobTitle}</p>
                          <p style="margin:2px 0 0;color:#64748b;font-size:13px;">{companyName}</p>
                        </div>
                        <p style="margin:0;color:#94a3b8;font-size:13px;">Trân trọng,<br><strong>Đội ngũ TechList</strong></p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                        <p style="margin:0;color:#94a3b8;font-size:12px;">© 2025 TechList. Email này được gửi tự động, vui lòng không trả lời.</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        return (subject, html);
    }
}
