using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.Auth.Interfaces;
using TechList.Application.Auth.Models;
using TechList.Domain.Entities;
using TechList.Domain.Enums;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly ITokenService _tokenService;
    private readonly IRefreshTokenService _refreshTokenService;

    public AuthService(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ITokenService tokenService,
        IRefreshTokenService refreshTokenService)
    {
        _db = db;
        _userManager = userManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
        _refreshTokenService = refreshTokenService;
    }

    public async Task RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        if (request.Role != AppRole.Candidate && request.Role != AppRole.Recruiter)
            throw new InvalidOperationException("Invalid role specified.");

        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
            throw new InvalidOperationException("Email already exists");

        await EnsureRolesCreatedAsync(ct);

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = false,
            FullName = request.DisplayName ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        var create = await _userManager.CreateAsync(user, request.Password);
        if (!create.Succeeded)
            throw new InvalidOperationException(string.Join("; ", create.Errors.Select(e => e.Description)));

        var addRole = await _userManager.AddToRoleAsync(user, request.Role);
        if (!addRole.Succeeded)
            throw new InvalidOperationException(string.Join("; ", addRole.Errors.Select(e => e.Description)));

        _db.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            DisplayName = request.DisplayName ?? request.Email.Split('@')[0],
            Bio = string.Empty,
            IsApproved = true,
            UpdatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, string? ip, string? userAgent, CancellationToken ct)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null)
            throw new UnauthorizedAccessException("Invalid credentials");

        if (!await _userManager.CheckPasswordAsync(user, request.Password))
            throw new UnauthorizedAccessException("Invalid credentials");

        var roles = (await _userManager.GetRolesAsync(user)).ToList();
        var profile = await EnsureProfileExistsAsync(user.Id, user.Email!, user.FullName, ct);

        if (!profile.IsApproved)
            throw new UnauthorizedAccessException("Tài khoản của bạn đã bị chặn. Vui lòng liên hệ quản trị viên.");

        return await IssueTokensAsync(user, profile, roles, ip, userAgent, ct);
    }

    public async Task<LoginResponse> RefreshAsync(string refreshToken, string? ip, string? userAgent, CancellationToken ct)
    {
        var tokenHash = _refreshTokenService.HashToken(refreshToken);

        var existing = await _db.RefreshTokens
            .AsTracking()
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, ct);

        if (existing is null || !existing.IsActive)
            throw new UnauthorizedAccessException("Invalid refresh token");

        var user = await _userManager.FindByIdAsync(existing.UserId);
        if (user is null)
            throw new UnauthorizedAccessException("User not found");

        var roles = (await _userManager.GetRolesAsync(user)).ToList();
        var profile = await EnsureProfileExistsAsync(user.Id, user.Email!, user.FullName, ct);

        // Rotation: revoke old token, issue a new one
        existing.RevokedAt = DateTime.UtcNow;
        existing.RevokedByIp = ip;

        var newRaw = _refreshTokenService.GenerateRawToken();
        var newHash = _refreshTokenService.HashToken(newRaw);
        existing.ReplacedByTokenHash = newHash;

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = newHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(14),
            CreatedByIp = ip,
            UserAgent = userAgent
        });

        await _db.SaveChangesAsync(ct);

        var (jwt, expiresIn) = await _tokenService.CreateAccessTokenAsync(
            new UserTokenSubject(user.Id, user.Email!, profile.DisplayName, roles),
            ct);

        return new LoginResponse(
            new AuthTokensResponse(jwt, expiresIn, newRaw),
            new UserDto(user.Id, user.Email!, profile.DisplayName, profile.AvatarUrl, roles));
    }

    public async Task LogoutAsync(string refreshToken, string? ip, CancellationToken ct)
    {
        var tokenHash = _refreshTokenService.HashToken(refreshToken);
        var existing = await _db.RefreshTokens.AsTracking().SingleOrDefaultAsync(x => x.TokenHash == tokenHash, ct);
        if (existing is null) return;

        existing.RevokedAt = DateTime.UtcNow;
        existing.RevokedByIp = ip;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<LoginResponse> ExternalLoginAsync(
        string provider,
        string providerKey,
        string email,
        string? name,
        string? ip,
        string? userAgent,
        CancellationToken ct)
    {
        await EnsureRolesCreatedAsync(ct);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var user = await _userManager.FindByLoginAsync(provider, providerKey);

        if (user is null)
        {
            user = await _userManager.FindByEmailAsync(email);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                    FullName = name ?? string.Empty,
                    CreatedAt = DateTime.UtcNow
                };

                var create = await _userManager.CreateAsync(user);
                if (!create.Succeeded)
                    throw new InvalidOperationException(string.Join("; ", create.Errors.Select(e => e.Description)));

                var addRole = await _userManager.AddToRoleAsync(user, AppRole.Candidate);
                if (!addRole.Succeeded)
                    throw new InvalidOperationException(string.Join("; ", addRole.Errors.Select(e => e.Description)));
            }

            var addLogin = await _userManager.AddLoginAsync(user, new UserLoginInfo(provider, providerKey, provider));
            if (!addLogin.Succeeded)
                throw new InvalidOperationException(string.Join("; ", addLogin.Errors.Select(e => e.Description)));
        }

        var roles = (await _userManager.GetRolesAsync(user)).ToList();
        var profile = await EnsureProfileExistsAsync(user.Id, user.Email!, user.FullName, ct, name);

        var response = await IssueTokensAsync(user, profile, roles, ip, userAgent, ct);
        await tx.CommitAsync(ct);
        return response;
    }

    private async Task<LoginResponse> IssueTokensAsync(
        ApplicationUser user,
        UserProfile profile,
        IReadOnlyList<string> roles,
        string? ip,
        string? userAgent,
        CancellationToken ct)
    {
        var (jwt, expiresIn) = await _tokenService.CreateAccessTokenAsync(
            new UserTokenSubject(user.Id, user.Email!, profile.DisplayName, roles),
            ct);

        var rawRefresh = _refreshTokenService.GenerateRawToken();
        var refreshHash = _refreshTokenService.HashToken(rawRefresh);

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = refreshHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(14),
            CreatedByIp = ip,
            UserAgent = userAgent
        });

        await _db.SaveChangesAsync(ct);

        return new LoginResponse(
            new AuthTokensResponse(jwt, expiresIn, rawRefresh),
            new UserDto(user.Id, user.Email!, profile.DisplayName, profile.AvatarUrl, roles));
    }

    private async Task EnsureRolesCreatedAsync(CancellationToken ct)
    {
        foreach (var role in AppRole.All)
        {
            if (await _roleManager.RoleExistsAsync(role)) continue;
            var create = await _roleManager.CreateAsync(new IdentityRole(role));
            if (!create.Succeeded)
                throw new InvalidOperationException(string.Join("; ", create.Errors.Select(e => e.Description)));
        }
    }

    private async Task<UserProfile> EnsureProfileExistsAsync(
        string userId,
        string email,
        string fallbackDisplayName,
        CancellationToken ct,
        string? displayName = null)
    {
        var profile = await _db.UserProfiles.AsTracking().SingleOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile is not null) return profile;

        profile = new UserProfile
        {
            UserId = userId,
            DisplayName = displayName ?? (!string.IsNullOrWhiteSpace(fallbackDisplayName) ? fallbackDisplayName : email.Split('@')[0]),
            Bio = string.Empty,
            IsApproved = true, // Legacy profiles assumed true or adjust based on role? We assume true for external login.
            UpdatedAt = DateTime.UtcNow
        };
        _db.UserProfiles.Add(profile);
        await _db.SaveChangesAsync(ct);
        return profile;
    }
}

