using TechList.Application.Admin.Models;

namespace TechList.Application.Admin.Interfaces;

public interface ITransactionManagementService
{
    // ── PACKAGES ──────────────────────────────────────────
    Task<List<PackageDto>> GetAllPackagesAsync(CancellationToken ct);
    Task<PackageDto> CreatePackageAsync(CreatePackageRequest request, CancellationToken ct);
    Task<PackageDto> UpdatePackageAsync(Guid id, UpdatePackageRequest request, CancellationToken ct);
    Task DeletePackageAsync(Guid id, CancellationToken ct);

    // ── SUBSCRIPTIONS ─────────────────────────────────────
    Task<List<SubscriptionDto>> GetSubscriptionsAsync(string? status, string? search, CancellationToken ct);
    Task ExtendSubscriptionAsync(Guid id, int extraDays, string adminUserId, CancellationToken ct);
    Task RevokeSubscriptionAsync(Guid id, string adminUserId, CancellationToken ct);
    Task ChangeSubscriptionPackageAsync(Guid id, Guid newPackageId, string adminUserId, CancellationToken ct);

    // ── TRANSACTIONS ──────────────────────────────────────
    Task<PagedResult<TransactionDto>> GetTransactionsAsync(TransactionFilterDto filter, CancellationToken ct);
    Task<TransactionDetailDto> GetTransactionByIdAsync(Guid id, CancellationToken ct);
    Task RefundTransactionAsync(Guid id, string reason, string adminUserId, CancellationToken ct);

    // ── COUPONS ───────────────────────────────────────────
    Task<List<CouponDto>> GetAllCouponsAsync(CancellationToken ct);
    Task<CouponDto> CreateCouponAsync(CreateCouponRequest request, CancellationToken ct);
    Task<CouponDto> UpdateCouponAsync(Guid id, UpdateCouponRequest request, CancellationToken ct);
    Task DeleteCouponAsync(Guid id, CancellationToken ct);

    // ── REVENUE ───────────────────────────────────────────
    Task<RevenueStatsDto> GetRevenueStatsAsync(CancellationToken ct);
    Task<List<RevenueTimeSeriesPointDto>> GetRevenueTimeSeriesAsync(DateTime from, DateTime to, string period, CancellationToken ct);
    Task<List<RevenueByPackageDto>> GetRevenueByPackageAsync(CancellationToken ct);
}
