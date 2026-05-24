namespace TechList.Infrastructure.Options;

public sealed class AnthropicSettings
{
    public const string SectionName = "Gemini";
    public string ApiKey { get; init; } = string.Empty;
    public string Model { get; init; } = "gemini-2.5-flash";
}
