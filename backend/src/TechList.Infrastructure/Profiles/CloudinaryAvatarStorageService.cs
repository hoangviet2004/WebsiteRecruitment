using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;
using TechList.Application.Profiles.Interfaces;
using TechList.Infrastructure.Options;

namespace TechList.Infrastructure.Profiles;

public sealed class CloudinaryAvatarStorageService : IAvatarStorageService
{
    private readonly Cloudinary _cloudinary;

    public CloudinaryAvatarStorageService(IOptions<CloudinarySettings> options)
    {
        var s = options.Value;
        _cloudinary = new Cloudinary(new Account(s.CloudName, s.ApiKey, s.ApiSecret))
        {
            Api = { Secure = true }
        };
    }

    public async Task<(string Url, string PublicId)> UploadAvatarAsync(Stream content, string fileName, CancellationToken ct)
    {
        var upload = new ImageUploadParams
        {
            File = new FileDescription(fileName, content),
            Folder = "avatars",
            UseFilename = true,
            UniqueFilename = true,
            Overwrite = false
        };

        var result = await _cloudinary.UploadAsync(upload, ct);
        if (result.Error is not null)
            throw new InvalidOperationException(result.Error.Message);

        return (result.SecureUrl.ToString(), result.PublicId);
    }

    public async Task DeleteAsync(string publicId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(publicId)) return;
        ct.ThrowIfCancellationRequested();
        await _cloudinary.DestroyAsync(new DeletionParams(publicId));
    }
}

