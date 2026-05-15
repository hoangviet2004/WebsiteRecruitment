namespace TechList.Infrastructure.Options;

public class EmailSettings
{
    public const string SectionName = "EmailSettings";
    public string Host { get; init; } = "";
    public int Port { get; init; } = 587;
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
    public string FromName { get; init; } = "TechList";
    public string FromEmail { get; init; } = "";
    public bool EnableSsl { get; init; } = true;
}
