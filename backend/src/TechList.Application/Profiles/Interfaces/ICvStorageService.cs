using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace TechList.Application.Profiles.Interfaces;

public interface ICvStorageService
{
    Task<(string Url, string PublicId)> UploadCvAsync(Stream content, string fileName, CancellationToken ct);
    Task DeleteAsync(string publicId, CancellationToken ct);
}
