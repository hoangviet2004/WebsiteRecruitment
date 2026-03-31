namespace TechList.Infrastructure.Options;

public sealed class CloudinarySettings
{
    public const string SectionName = "Cloudinary";

    public string CloudName { get; init; } = default!;
    public string ApiKey { get; init; } = default!;
    public string ApiSecret { get; init; } = default!;
}

