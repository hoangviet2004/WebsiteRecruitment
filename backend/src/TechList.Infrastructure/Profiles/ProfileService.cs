using Microsoft.EntityFrameworkCore;
using TechList.Application.Profiles.Interfaces;
using TechList.Application.Profiles.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Profiles;

public sealed class ProfileService : IProfileService
{
    private readonly AppDbContext _db;
    private readonly IAvatarStorageService _avatarStorage;

    public ProfileService(AppDbContext db, IAvatarStorageService avatarStorage)
    {
        _db = db;
        _avatarStorage = avatarStorage;
    }

    public async Task<ProfileDto> GetMyProfileAsync(string userId, CancellationToken ct)
    {
        var profile = await _db.UserProfiles.SingleOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile is null)
            throw new InvalidOperationException("Profile not found");

        return ToDto(profile);
    }

    public async Task<ProfileDto> UpdateMyProfileAsync(string userId, UpdateProfileRequest request, CancellationToken ct)
    {
        var profile = await _db.UserProfiles.AsTracking().SingleOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile is null)
            throw new InvalidOperationException("Profile not found");

        profile.DisplayName = request.DisplayName;
        profile.Bio = request.Bio ?? string.Empty;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ToDto(profile);
    }

    public async Task<ProfileDto> UpdateAvatarAsync(string userId, Stream content, string fileName, CancellationToken ct)
    {
        var profile = await _db.UserProfiles.AsTracking().SingleOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile is null)
            throw new InvalidOperationException("Profile not found");

        var oldPublicId = profile.AvatarPublicId;
        var (url, publicId) = await _avatarStorage.UploadAvatarAsync(content, fileName, ct);

        profile.AvatarUrl = url;
        profile.AvatarPublicId = publicId;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(oldPublicId) && oldPublicId != publicId)
            await _avatarStorage.DeleteAsync(oldPublicId, ct);

        return ToDto(profile);
    }

    private static ProfileDto ToDto(UserProfile profile) =>
        new(profile.UserId, profile.DisplayName, profile.Bio, profile.AvatarUrl);
}

