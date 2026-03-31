using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Auth.Interfaces;
using TechList.Application.Auth.Models;
using TechList.Infrastructure.Identity;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        SignInManager<ApplicationUser> signInManager,
        IHttpClientFactory httpClientFactory,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _signInManager = signInManager;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<object>>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        await _authService.RegisterAsync(request, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Registered successfully"));
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();

        try
        {
            var result = await _authService.LoginAsync(request, ip, ua, ct);
            _logger.LogInformation("Login success for {Email}", request.Email);
            return Ok(ApiResponse<LoginResponse>.Ok(result, "Login successful"));
        }
        catch
        {
            _logger.LogWarning("Login failed for {Email}", request.Email);
            throw;
        }
    }

    [HttpGet("google")]
    public IActionResult Google([FromQuery] string? returnUrl = null)
    {
        var redirectUrl = Url.Action(nameof(GoogleCallback), "Auth", new { returnUrl })!;
        var props = _signInManager.ConfigureExternalAuthenticationProperties("Google", redirectUrl);
        return Challenge(props, "Google");
    }

    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string? returnUrl = null, CancellationToken ct = default)
    {
        var info = await _signInManager.GetExternalLoginInfoAsync();
        if (info is null) throw new InvalidOperationException("External login info not found");

        var provider = info.LoginProvider;
        var providerKey = info.ProviderKey;
        var email = info.Principal.FindFirstValue(ClaimTypes.Email) ?? info.Principal.FindFirstValue("email");
        var name = info.Principal.FindFirstValue(ClaimTypes.Name);

        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException("Email not provided by Google");

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();

        try
        {
            var result = await _authService.ExternalLoginAsync(provider, providerKey, email, name, ip, ua, ct);
            _logger.LogInformation("OAuth {Provider} success for {Email}", provider, email);
            await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);
            return OAuthReturn(returnUrl, result);
        }
        catch
        {
            _logger.LogWarning("OAuth {Provider} failed", provider);
            throw;
        }
    }

    [HttpGet("github")]
    public IActionResult GitHub([FromQuery] string? returnUrl = null)
    {
        var redirectUrl = Url.Action(nameof(GitHubCallback), "Auth", new { returnUrl })!;
        var props = _signInManager.ConfigureExternalAuthenticationProperties("GitHub", redirectUrl);
        return Challenge(props, "GitHub");
    }

    [HttpGet("github/callback")]
    public async Task<IActionResult> GitHubCallback([FromQuery] string? returnUrl = null, CancellationToken ct = default)
    {
        var info = await _signInManager.GetExternalLoginInfoAsync();
        if (info is null) throw new InvalidOperationException("External login info not found");

        var provider = info.LoginProvider; // "GitHub"
        var providerKey = info.ProviderKey;

        var email = info.Principal.FindFirstValue(ClaimTypes.Email) ?? info.Principal.FindFirstValue("email");
        var name = info.Principal.FindFirstValue(ClaimTypes.Name) ?? info.Principal.FindFirstValue("name");

        // GitHub may not return email in claims. Resolve via GitHub API using access_token.
        if (string.IsNullOrWhiteSpace(email))
        {
            var ghToken = info.AuthenticationTokens?.FirstOrDefault(t => t.Name == "access_token")?.Value;
            if (!string.IsNullOrWhiteSpace(ghToken))
                email = await ResolveGitHubPrimaryEmailAsync(ghToken, ct);
        }

        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException("Email not available from GitHub. Ensure scope 'user:email' and a verified email exists.");

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();

        try
        {
            var result = await _authService.ExternalLoginAsync(provider, providerKey, email, name, ip, ua, ct);
            _logger.LogInformation("OAuth {Provider} success for {Email}", provider, email);
            await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);
            return OAuthReturn(returnUrl, result);
        }
        catch
        {
            _logger.LogWarning("OAuth {Provider} failed", provider);
            throw;
        }
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> RefreshToken([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();
        var result = await _authService.RefreshAsync(request.RefreshToken, ip, ua, ct);
        return Ok(ApiResponse<LoginResponse>.Ok(result, "Token refreshed"));
    }

    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse<object>>> Logout([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _authService.LogoutAsync(request.RefreshToken, ip, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Logged out"));
    }

    private IActionResult OAuthReturn(string? returnUrl, LoginResponse result)
    {
        if (string.IsNullOrWhiteSpace(returnUrl))
            return Ok(ApiResponse<LoginResponse>.Ok(result, "OAuth login successful"));

        // Demo-friendly redirect (production: prefer HttpOnly refresh cookie + code exchange)
        var redirect = $"{returnUrl}#accessToken={Uri.EscapeDataString(result.Tokens.AccessToken)}&refreshToken={Uri.EscapeDataString(result.Tokens.RefreshToken)}";
        return Redirect(redirect);
    }

    private async Task<string?> ResolveGitHubPrimaryEmailAsync(string accessToken, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("TechListAPI");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

        using var resp = await client.GetAsync("https://api.github.com/user/emails", ct);
        if (!resp.IsSuccessStatusCode) return null;

        var json = await resp.Content.ReadAsStringAsync(ct);
        var emails = JsonSerializer.Deserialize<List<GitHubEmail>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        var primary = emails?.FirstOrDefault(e => e.Primary && e.Verified)?.Email
                      ?? emails?.FirstOrDefault(e => e.Verified)?.Email;
        return primary;
    }

    private sealed record GitHubEmail(string Email, bool Primary, bool Verified);
}