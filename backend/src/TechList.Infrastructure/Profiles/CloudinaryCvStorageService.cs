using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;
using TechList.Application.Profiles.Interfaces;
using TechList.Infrastructure.Options;
using System;

namespace TechList.Infrastructure.Profiles;

public sealed class CloudinaryCvStorageService : ICvStorageService
{
    private readonly Cloudinary _cloudinary;

    public CloudinaryCvStorageService(IOptions<CloudinarySettings> options)
    {
        var s = options.Value;
        _cloudinary = new Cloudinary(new Account(s.CloudName, s.ApiKey, s.ApiSecret))
        {
            Api = { Secure = true }
        };
    }

    public async Task<(string Url, string PublicId)> UploadCvAsync(Stream content, string fileName, CancellationToken ct)
    {
        var upload = new RawUploadParams
        {
            File = new FileDescription(fileName, content),
            Folder = "cvs",
            UseFilename = true,
            UniqueFilename = true,
            Overwrite = false
        };

        var result = await Task.Run(() => _cloudinary.Upload(upload), ct);
        if (result.Error is not null)
            throw new InvalidOperationException(result.Error.Message);

        return (result.SecureUrl.ToString(), result.PublicId);
    }

    public async Task DeleteAsync(string publicId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(publicId)) return;
        ct.ThrowIfCancellationRequested();
        await _cloudinary.DestroyAsync(new DeletionParams(publicId) { ResourceType = ResourceType.Raw });
    }
}
