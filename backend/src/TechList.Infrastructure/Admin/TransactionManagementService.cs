using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.Admin.Interfaces;
using TechList.Application.Admin.Models;
using TechList.Domain.Entities;
using TechList.Domain.Enums;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Admin;

public sealed class TransactionManagementService : ITransactionManagementService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public TransactionManagementService(AppDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // ══════════════════════════════════════════════════════════
    // PACKAGES
    // ══════════════════════════════════════════════════════════

    public async Task<List<PackageDto>> GetAllPackagesAsync(CancellationToken ct)
    {
        return await _db.ServicePackages
            .AsNoTracking()
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.Price)
            .Select(x => new PackageDto(
                x.Id, x.Name, x.Price, x.MaxJobPosts, x.DurationDays,
                x.Features, x.IsHighlighted, x.IsActive, x.DisplayOrder,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);
    }

    public async Task<PackageDto> CreatePackageAsync(CreatePackageRequest request, CancellationToken ct)
    {
        var package = new ServicePackage
        {
            Name = request.Name,
            Price = request.Price,
            MaxJobPosts = request.MaxJobPosts,
            DurationDays = request.DurationDays,
            Features = request.Features ?? "[]",
            IsHighlighted = request.IsHighlighted,
            IsActive = request.IsActive,
            DisplayOrder = request.DisplayOrder
        };

        _db.ServicePackages.Add(package);
        await _db.SaveChangesAsync(ct);

        return new PackageDto(
            package.Id, package.Name, package.Price, package.MaxJobPosts,
            package.DurationDays, package.Features, package.IsHighlighted,
            package.IsActive, package.DisplayOrder, package.CreatedAt, package.UpdatedAt);
    }

    public async Task<PackageDto> UpdatePackageAsync(Guid id, UpdatePackageRequest request, CancellationToken ct)
    {
        var package = await _db.ServicePackages.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Package not found");

        package.Name = request.Name;
        package.Price = request.Price;
        package.MaxJobPosts = request.MaxJobPosts;
        package.DurationDays = request.DurationDays;
        package.Features = request.Features ?? "[]";
        package.IsHighlighted = request.IsHighlighted;
        package.IsActive = request.IsActive;
        package.DisplayOrder = request.DisplayOrder;
        package.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new PackageDto(
            package.Id, package.Name, package.Price, package.MaxJobPosts,
            package.DurationDays, package.Features, package.IsHighlighted,
            package.IsActive, package.DisplayOrder, package.CreatedAt, package.UpdatedAt);
    }

    public async Task DeletePackageAsync(Guid id, CancellationToken ct)
    {
        var package = await _db.ServicePackages.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Package not found");

        // Kiểm tra có subscription đang active không
        var hasActiveSubscriptions = await _db.Subscriptions
            .AnyAsync(x => x.PackageId == id && x.Status == SubscriptionStatus.Active, ct);

        if (hasActiveSubscriptions)
            throw new InvalidOperationException("Cannot delete package with active subscriptions. Deactivate it instead.");

        _db.ServicePackages.Remove(package);
        await _db.SaveChangesAsync(ct);
    }

    // ══════════════════════════════════════════════════════════
    // SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════════

    public async Task<List<SubscriptionDto>> GetSubscriptionsAsync(string? status, string? search, CancellationToken ct)
    {
        var query = _db.Subscriptions
            .Include(x => x.Package)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var subscriptions = await query
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        var userIds = subscriptions.Select(x => x.UserId).Distinct().ToList();
        var users = await _userManager.Users
            .Where(u => userIds.Contains(u.Id))
            .AsNoTracking()
            .ToDictionaryAsync(u => u.Id, ct);

        var companies = await _db.Companies
            .Where(c => userIds.Contains(c.OwnerId))
            .AsNoTracking()
            .ToDictionaryAsync(c => c.OwnerId, ct);

        var result = subscriptions.Select(s =>
        {
            users.TryGetValue(s.UserId, out var user);
            companies.TryGetValue(s.UserId, out var company);
            var daysRemaining = Math.Max(0, (int)(s.EndDate - DateTime.UtcNow).TotalDays);

            return new SubscriptionDto(
                s.Id, s.UserId,
                user?.Email ?? "N/A",
                user?.FullName ?? "N/A",
                company?.Name ?? "N/A",
                s.PackageId, s.Package.Name,
                s.StartDate, s.EndDate, s.Status,
                s.JobPostsUsed, s.Package.MaxJobPosts,
                daysRemaining, s.CreatedAt);
        }).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.ToLower();
            result = result.Where(x =>
                x.UserEmail.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                x.UserFullName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                x.CompanyName.Contains(term, StringComparison.OrdinalIgnoreCase)
            ).ToList();
        }

        return result;
    }

    public async Task ExtendSubscriptionAsync(Guid id, int extraDays, string adminUserId, CancellationToken ct)
    {
        var sub = await _db.Subscriptions.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Subscription not found");

        sub.EndDate = sub.EndDate.AddDays(extraDays);
        if (sub.Status == SubscriptionStatus.Expired)
            sub.Status = SubscriptionStatus.Active;
        sub.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "ExtendSubscription",
            EntityType = "Subscription",
            EntityId = id.ToString(),
            PerformedBy = adminUserId,
            Details = JsonSerializer.Serialize(new { extraDays, newEndDate = sub.EndDate })
        });

        await _db.SaveChangesAsync(ct);
    }

    public async Task RevokeSubscriptionAsync(Guid id, string adminUserId, CancellationToken ct)
    {
        var sub = await _db.Subscriptions.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Subscription not found");

        sub.Status = SubscriptionStatus.Revoked;
        sub.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "RevokeSubscription",
            EntityType = "Subscription",
            EntityId = id.ToString(),
            PerformedBy = adminUserId,
            Details = JsonSerializer.Serialize(new { previousStatus = sub.Status, userId = sub.UserId })
        });

        await _db.SaveChangesAsync(ct);
    }

    public async Task ChangeSubscriptionPackageAsync(Guid id, Guid newPackageId, string adminUserId, CancellationToken ct)
    {
        var sub = await _db.Subscriptions.Include(x => x.Package).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Subscription not found");

        var newPackage = await _db.ServicePackages.FirstOrDefaultAsync(x => x.Id == newPackageId, ct)
            ?? throw new InvalidOperationException("New package not found");

        var oldPackageName = sub.Package.Name;
        sub.PackageId = newPackageId;
        sub.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "ChangeSubscriptionPackage",
            EntityType = "Subscription",
            EntityId = id.ToString(),
            PerformedBy = adminUserId,
            Details = JsonSerializer.Serialize(new { oldPackage = oldPackageName, newPackage = newPackage.Name })
        });

        await _db.SaveChangesAsync(ct);
    }

    // ══════════════════════════════════════════════════════════
    // TRANSACTIONS
    // ══════════════════════════════════════════════════════════

    public async Task<PagedResult<TransactionDto>> GetTransactionsAsync(TransactionFilterDto filter, CancellationToken ct)
    {
        var query = _db.Transactions
            .Include(x => x.Package)
            .Include(x => x.Coupon)
            .AsNoTracking()
            .AsQueryable();

        // Filters
        if (!string.IsNullOrWhiteSpace(filter.Status))
            query = query.Where(x => x.Status == filter.Status);

        if (!string.IsNullOrWhiteSpace(filter.PaymentMethod))
            query = query.Where(x => x.PaymentMethod == filter.PaymentMethod);

        if (filter.FromDate.HasValue)
            query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
            query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var term = filter.SearchTerm.ToLower();
            query = query.Where(x =>
                x.TransactionCode.ToLower().Contains(term) ||
                x.CompanyName.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(filter.CompanyName))
        {
            var companyTerm = filter.CompanyName.ToLower();
            query = query.Where(x => x.CompanyName.ToLower().Contains(companyTerm));
        }

        // Count + paginate
        var totalCount = await query.CountAsync(ct);
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var totalPages = Math.Max(1, (int)Math.Ceiling((double)totalCount / pageSize));

        // Lấy danh sách userId từ transactions để join với Users
        var transactions = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var userIds = transactions.Select(x => x.UserId).Distinct().ToList();
        var usersDict = await _userManager.Users
            .Where(u => userIds.Contains(u.Id))
            .AsNoTracking()
            .ToDictionaryAsync(u => u.Id, ct);

        var items = transactions.Select(t =>
        {
            usersDict.TryGetValue(t.UserId, out var user);
            return new TransactionDto(
                t.Id, t.TransactionCode, t.UserId,
                user?.Email ?? "N/A", t.CompanyName,
                t.PackageId, t.Package.Name,
                t.Amount, t.DiscountAmount, t.FinalAmount,
                t.Coupon?.Code, t.PaymentMethod,
                t.Status, t.CreatedAt);
        }).ToList();

        return new PagedResult<TransactionDto>(items, totalCount, page, pageSize, totalPages);
    }

    public async Task<TransactionDetailDto> GetTransactionByIdAsync(Guid id, CancellationToken ct)
    {
        var t = await _db.Transactions
            .Include(x => x.Package)
            .Include(x => x.Coupon)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Transaction not found");

        var user = await _userManager.FindByIdAsync(t.UserId);

        return new TransactionDetailDto(
            t.Id, t.TransactionCode, t.UserId,
            user?.Email ?? "N/A", user?.FullName ?? "N/A",
            t.CompanyName, t.PackageId, t.Package.Name, t.Package.Price,
            t.Amount, t.DiscountAmount, t.FinalAmount,
            t.CouponId, t.Coupon?.Code, t.PaymentMethod,
            t.Status, t.PaymentGatewayRef, t.StatusHistory,
            t.RefundReason, t.RefundedBy, t.CreatedAt, t.UpdatedAt);
    }

    public async Task RefundTransactionAsync(Guid id, string reason, string adminUserId, CancellationToken ct)
    {
        var t = await _db.Transactions.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Transaction not found");

        if (t.Status == TransactionStatus.Refunded)
            throw new InvalidOperationException("Transaction already refunded");

        if (t.Status != TransactionStatus.Success)
            throw new InvalidOperationException("Only successful transactions can be refunded");

        t.Status = TransactionStatus.Refunded;
        t.RefundReason = reason;
        t.RefundedBy = adminUserId;
        t.UpdatedAt = DateTime.UtcNow;

        // Cập nhật status history
        var history = JsonSerializer.Deserialize<List<object>>(t.StatusHistory) ?? new List<object>();
        history.Add(new { status = TransactionStatus.Refunded, timestamp = DateTime.UtcNow, note = reason });
        t.StatusHistory = JsonSerializer.Serialize(history);

        // Ghi audit log
        _db.AuditLogs.Add(new AuditLog
        {
            Action = "RefundTransaction",
            EntityType = "Transaction",
            EntityId = id.ToString(),
            PerformedBy = adminUserId,
            Details = JsonSerializer.Serialize(new { reason, amount = t.FinalAmount, transactionCode = t.TransactionCode })
        });

        await _db.SaveChangesAsync(ct);
    }

    // ══════════════════════════════════════════════════════════
    // COUPONS
    // ══════════════════════════════════════════════════════════

    public async Task<List<CouponDto>> GetAllCouponsAsync(CancellationToken ct)
    {
        return await _db.Coupons
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CouponDto(
                x.Id, x.Code, x.DiscountType, x.DiscountValue,
                x.MaxUsageCount, x.CurrentUsageCount, x.ExpiresAt,
                x.ApplicablePackageIds, x.IsActive, x.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<CouponDto> CreateCouponAsync(CreateCouponRequest request, CancellationToken ct)
    {
        // Kiểm tra code trùng
        var exists = await _db.Coupons.AnyAsync(x => x.Code == request.Code, ct);
        if (exists) throw new InvalidOperationException("Coupon code already exists");

        var coupon = new Coupon
        {
            Code = request.Code.ToUpper(),
            DiscountType = request.DiscountType,
            DiscountValue = request.DiscountValue,
            MaxUsageCount = request.MaxUsageCount,
            ExpiresAt = request.ExpiresAt,
            ApplicablePackageIds = request.ApplicablePackageIds ?? "[]",
            IsActive = request.IsActive
        };

        _db.Coupons.Add(coupon);
        await _db.SaveChangesAsync(ct);

        return new CouponDto(
            coupon.Id, coupon.Code, coupon.DiscountType, coupon.DiscountValue,
            coupon.MaxUsageCount, coupon.CurrentUsageCount, coupon.ExpiresAt,
            coupon.ApplicablePackageIds, coupon.IsActive, coupon.CreatedAt);
    }

    public async Task<CouponDto> UpdateCouponAsync(Guid id, UpdateCouponRequest request, CancellationToken ct)
    {
        var coupon = await _db.Coupons.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Coupon not found");

        // Kiểm tra code trùng với coupon khác
        var codeExists = await _db.Coupons.AnyAsync(x => x.Code == request.Code && x.Id != id, ct);
        if (codeExists) throw new InvalidOperationException("Coupon code already exists");

        coupon.Code = request.Code.ToUpper();
        coupon.DiscountType = request.DiscountType;
        coupon.DiscountValue = request.DiscountValue;
        coupon.MaxUsageCount = request.MaxUsageCount;
        coupon.ExpiresAt = request.ExpiresAt;
        coupon.ApplicablePackageIds = request.ApplicablePackageIds ?? "[]";
        coupon.IsActive = request.IsActive;

        await _db.SaveChangesAsync(ct);

        return new CouponDto(
            coupon.Id, coupon.Code, coupon.DiscountType, coupon.DiscountValue,
            coupon.MaxUsageCount, coupon.CurrentUsageCount, coupon.ExpiresAt,
            coupon.ApplicablePackageIds, coupon.IsActive, coupon.CreatedAt);
    }

    public async Task DeleteCouponAsync(Guid id, CancellationToken ct)
    {
        var coupon = await _db.Coupons.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Coupon not found");

        _db.Coupons.Remove(coupon);
        await _db.SaveChangesAsync(ct);
    }

    // ══════════════════════════════════════════════════════════
    // REVENUE STATISTICS
    // ══════════════════════════════════════════════════════════

    public async Task<RevenueStatsDto> GetRevenueStatsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var startOfToday = now.Date;
        var startOfWeek = now.Date.AddDays(-(int)now.DayOfWeek);
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var successTransactions = _db.Transactions
            .Where(x => x.Status == TransactionStatus.Success);

        var todayRevenue = await successTransactions
            .Where(x => x.CreatedAt >= startOfToday)
            .SumAsync(x => x.FinalAmount, ct);

        var weekRevenue = await successTransactions
            .Where(x => x.CreatedAt >= startOfWeek)
            .SumAsync(x => x.FinalAmount, ct);

        var monthRevenue = await successTransactions
            .Where(x => x.CreatedAt >= startOfMonth)
            .SumAsync(x => x.FinalAmount, ct);

        var allRevenue = await successTransactions
            .SumAsync(x => x.FinalAmount, ct);

        var totalTransactions = await _db.Transactions.CountAsync(ct);
        var successCount = await _db.Transactions.CountAsync(x => x.Status == TransactionStatus.Success, ct);
        var failedCount = await _db.Transactions.CountAsync(x => x.Status == TransactionStatus.Failed, ct);
        var refundedCount = await _db.Transactions.CountAsync(x => x.Status == TransactionStatus.Refunded, ct);

        return new RevenueStatsDto(
            todayRevenue, weekRevenue, monthRevenue, allRevenue,
            totalTransactions, successCount, failedCount, refundedCount);
    }

    public async Task<List<RevenueTimeSeriesPointDto>> GetRevenueTimeSeriesAsync(
        DateTime from, DateTime to, string period, CancellationToken ct)
    {
        var transactions = await _db.Transactions
            .Where(x => x.Status == TransactionStatus.Success && x.CreatedAt >= from && x.CreatedAt <= to)
            .AsNoTracking()
            .ToListAsync(ct);

        var grouped = period switch
        {
            "day" => transactions.GroupBy(x => x.CreatedAt.Date.ToString("dd/MM")),
            "week" => transactions.GroupBy(x => $"W{GetIsoWeekOfYear(x.CreatedAt)}"),
            _ => transactions.GroupBy(x => x.CreatedAt.ToString("MM/yyyy"))
        };

        return grouped
            .Select(g => new RevenueTimeSeriesPointDto(g.Key, g.Sum(x => x.FinalAmount), g.Count()))
            .OrderBy(x => x.Label)
            .ToList();
    }

    public async Task<List<RevenueByPackageDto>> GetRevenueByPackageAsync(CancellationToken ct)
    {
        return await _db.Transactions
            .Where(x => x.Status == TransactionStatus.Success)
            .Include(x => x.Package)
            .GroupBy(x => new { x.PackageId, x.Package.Name })
            .Select(g => new RevenueByPackageDto(
                g.Key.PackageId,
                g.Key.Name,
                g.Sum(x => x.FinalAmount),
                g.Count()))
            .OrderByDescending(x => x.TotalRevenue)
            .AsNoTracking()
            .ToListAsync(ct);
    }

    // ── Helper ───────────────────────────────────────────────
    private static int GetIsoWeekOfYear(DateTime date)
    {
        var day = System.Globalization.CultureInfo.InvariantCulture.Calendar.GetDayOfWeek(date);
        if (day >= DayOfWeek.Monday && day <= DayOfWeek.Wednesday) date = date.AddDays(3);
        return System.Globalization.CultureInfo.InvariantCulture.Calendar.GetWeekOfYear(
            date, System.Globalization.CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday);
    }
}
