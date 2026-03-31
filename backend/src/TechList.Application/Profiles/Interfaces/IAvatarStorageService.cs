using System.IO;

namespace TechList.Application.Profiles.Interfaces;

public interface IAvatarStorageService
{
    Task<(string Url, string PublicId)> UploadAvatarAsync(Stream content, string fileName, CancellationToken ct);
    Task DeleteAsync(string publicId, CancellationToken ct);
}

