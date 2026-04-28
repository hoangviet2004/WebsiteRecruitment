using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TechList.API.Common;
using TechList.Application.Admin.Models;
using TechList.Infrastructure.Persistence;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using TechList.Domain.Entities;
using TechList.Domain.Enums;

namespace TechList.API.Controllers;

/// <summary>
/// Public endpoint cho phép lấy danh sách gói dịch vụ đang hoạt động.
/// </summary>
[ApiController]
[Route("api/packages")]
public sealed class PackageController : ControllerBase
{
    private readonly AppDbContext _db;

    public PackageController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>Lấy danh sách gói dịch vụ đang hoạt động (public).</summary>
    [HttpGet("active")]
    public async Task<ActionResult<ApiResponse<List<PackageDto>>>> GetActivePackages(CancellationToken ct)
    {
        var packages = await _db.ServicePackages
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.Price)
            .Select(p => new PackageDto(
                p.Id, p.Name, p.Price, p.MaxJobPosts, p.DurationDays,
                p.Features, p.IsHighlighted, p.IsActive, p.DisplayOrder,
                p.CreatedAt, p.UpdatedAt))
            .ToListAsync(ct);

        return Ok(ApiResponse<List<PackageDto>>.Ok(packages));
    }

    /// <summary>Lấy thông tin gói dịch vụ hiện tại của nhà tuyển dụng.</summary>
    [HttpGet("my-subscription")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<object>>> GetMySubscription(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        var subscription = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (subscription == null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                hasSubscription = false,
                packageName = (string?)null,
                maxJobPosts = 0,
                jobPostsUsed = 0,
                endDate = (DateTime?)null,
                daysRemaining = 0
            }));
        }

        // Auto-expire if past end date
        if (subscription.EndDate < DateTime.UtcNow)
        {
            subscription.Status = SubscriptionStatus.Expired;
            await _db.SaveChangesAsync(ct);

            return Ok(ApiResponse<object>.Ok(new
            {
                hasSubscription = false,
                packageName = subscription.Package.Name,
                maxJobPosts = subscription.Package.MaxJobPosts,
                jobPostsUsed = subscription.JobPostsUsed,
                endDate = subscription.EndDate,
                daysRemaining = 0,
                expired = true
            }));
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            hasSubscription = true,
            subscriptionId = subscription.Id,
            packageId = subscription.Package.Id,
            packageName = subscription.Package.Name,
            maxJobPosts = subscription.Package.MaxJobPosts,
            jobPostsUsed = subscription.JobPostsUsed,
            jobPostsRemaining = subscription.Package.MaxJobPosts == -1
                ? -1
                : subscription.Package.MaxJobPosts - subscription.JobPostsUsed,
            startDate = subscription.StartDate,
            endDate = subscription.EndDate,
            daysRemaining = Math.Max(0, (int)(subscription.EndDate - DateTime.UtcNow).TotalDays),
            packagePrice = subscription.Package.Price,
            packageFeatures = subscription.Package.Features
        }));
    }

    /// <summary>Đăng ký gói dịch vụ (Free = tự động kích hoạt, trả phí = placeholder).</summary>
    [HttpPost("register/{packageId:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<object>>> RegisterPackage(Guid packageId, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        var package = await _db.ServicePackages.FindAsync(new object[] { packageId }, ct);
        if (package == null || !package.IsActive)
            return NotFound(ApiResponse<object>.Fail("Gói dịch vụ không tồn tại hoặc đã ngưng hoạt động."));

        // Check if user already has active subscription
        var currentSub = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);

        // Count actual job posts from DB
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.OwnerId == userId, ct);
        var actualJobCount = company != null
            ? await _db.JobPosts.CountAsync(j => j.CompanyId == company.Id, ct)
            : 0;

        // For Free package: activate immediately
        if (package.Price == 0)
        {
            if (currentSub != null && currentSub.Package.Price == 0)
                return BadRequest(ApiResponse<object>.Fail("Bạn đã đang sử dụng gói Free."));

            // Revoke old subscription if any
            if (currentSub != null)
            {
                currentSub.Status = SubscriptionStatus.Revoked;
                currentSub.UpdatedAt = DateTime.UtcNow;
            }

            var newSub = new Subscription
            {
                UserId = userId!,
                PackageId = package.Id,
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddDays(package.DurationDays),
                Status = SubscriptionStatus.Active,
                JobPostsUsed = actualJobCount
            };
            _db.Subscriptions.Add(newSub);
            await _db.SaveChangesAsync(ct);

            return Ok(ApiResponse<object>.Ok(new { subscriptionId = newSub.Id },
                $"Đã kích hoạt gói \"{package.Name}\" thành công!"));
        }

        // For paid packages: create a pending transaction (placeholder for payment integration)
        var transactionCode = $"TXN-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var transaction = new Transaction
        {
            TransactionCode = transactionCode,
            UserId = userId!,
            CompanyName = company?.Name ?? "",
            PackageId = package.Id,
            Amount = package.Price,
            DiscountAmount = 0,
            FinalAmount = package.Price,
            PaymentMethod = "Manual",
            Status = TransactionStatus.Pending
        };
        _db.Transactions.Add(transaction);
        await _db.SaveChangesAsync(ct);

        // For demo: auto-approve the transaction and create subscription
        transaction.Status = TransactionStatus.Success;
        transaction.UpdatedAt = DateTime.UtcNow;

        // Revoke old subscription
        if (currentSub != null)
        {
            currentSub.Status = SubscriptionStatus.Revoked;
            currentSub.UpdatedAt = DateTime.UtcNow;
        }

        var paidSub = new Subscription
        {
            UserId = userId!,
            PackageId = package.Id,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(package.DurationDays),
            Status = SubscriptionStatus.Active,
            JobPostsUsed = actualJobCount
        };
        _db.Subscriptions.Add(paidSub);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.Ok(new { subscriptionId = paidSub.Id, transactionCode },
            $"Đã đăng ký gói \"{package.Name}\" thành công!"));
    }
}
