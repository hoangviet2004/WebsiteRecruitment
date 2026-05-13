using TechList.Application.Profiles.Models;

namespace TechList.Application.Profiles.Interfaces;

public interface IProfileService
{
    Task<ProfileDto> GetMyProfileAsync(string userId, CancellationToken ct);
    Task<ProfileDto> GetPublicProfileAsync(string userId, CancellationToken ct);
    Task<ProfileDto> UpdateMyProfileAsync(string userId, UpdateProfileRequest request, CancellationToken ct);
    Task<ProfileDto> UpdateAvatarAsync(string userId, Stream content, string fileName, CancellationToken ct);
    Task<ProfileDto> UpdateCvAsync(string userId, Stream content, string fileName, CancellationToken ct);
    Task<string> GetCvViewUrlAsync(string userId, CancellationToken ct);
    Task<string> GetCvViewUrlByUserIdAsync(string candidateId, CancellationToken ct);
    Task<string> GetCvDownloadUrlAsync(string userId, CancellationToken ct);
}

