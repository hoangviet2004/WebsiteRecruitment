namespace TechList.Application.Admin.Models;

// ══════════════════════════════════════════════════════════
// Generic paged result
// ══════════════════════════════════════════════════════════
public sealed record PagedResult<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

// ══════════════════════════════════════════════════════════
// SERVICE PACKAGE DTOs
// ══════════════════════════════════════════════════════════
public sealed record PackageDto(
    Guid Id,
    string Name,
    long Price,
    int MaxJobPosts,
    int DurationDays,
    string Features,       // JSON array
    bool IsHighlighted,
    bool IsActive,
    int DisplayOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public sealed record CreatePackageRequest(
    string Name,
    long Price,
    int MaxJobPosts,
    int DurationDays,
    string? Features,
    bool IsHighlighted,
    bool IsActive,
    int DisplayOrder
);

public sealed record UpdatePackageRequest(
    string Name,
    long Price,
    int MaxJobPosts,
    int DurationDays,
    string? Features,
    bool IsHighlighted,
    bool IsActive,
    int DisplayOrder
);

// ══════════════════════════════════════════════════════════
// SUBSCRIPTION DTOs
// ══════════════════════════════════════════════════════════
public sealed record SubscriptionDto(
    Guid Id,
    string UserId,
    string UserEmail,
    string UserFullName,
    string CompanyName,
    Guid PackageId,
    string PackageName,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    int JobPostsUsed,
    int MaxJobPosts,
    int DaysRemaining,
    DateTime CreatedAt
);

public sealed record ExtendSubscriptionRequest(int ExtraDays);

public sealed record ChangePackageRequest(Guid NewPackageId);

// ══════════════════════════════════════════════════════════
// TRANSACTION DTOs
// ══════════════════════════════════════════════════════════
public sealed record TransactionDto(
    Guid Id,
    string TransactionCode,
    string UserId,
    string UserEmail,
    string CompanyName,
    Guid PackageId,
    string PackageName,
    long Amount,
    long DiscountAmount,
    long FinalAmount,
    string? CouponCode,
    string PaymentMethod,
    string Status,
    DateTime CreatedAt
);

public sealed record TransactionDetailDto(
    Guid Id,
    string TransactionCode,
    string UserId,
    string UserEmail,
    string UserFullName,
    string CompanyName,
    Guid PackageId,
    string PackageName,
    long PackagePrice,
    long Amount,
    long DiscountAmount,
    long FinalAmount,
    Guid? CouponId,
    string? CouponCode,
    string PaymentMethod,
    string Status,
    string? PaymentGatewayRef,
    string StatusHistory,      // JSON
    string? RefundReason,
    string? RefundedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public sealed record TransactionFilterDto(
    string? Status,
    string? PaymentMethod,
    string? CompanyName,
    string? SearchTerm,        // mã giao dịch hoặc tên công ty
    DateTime? FromDate,
    DateTime? ToDate,
    int Page = 1,
    int PageSize = 20
);

public sealed record RefundRequest(string Reason);

// ══════════════════════════════════════════════════════════
// COUPON DTOs
// ══════════════════════════════════════════════════════════
public sealed record CouponDto(
    Guid Id,
    string Code,
    string DiscountType,
    long DiscountValue,
    int MaxUsageCount,
    int CurrentUsageCount,
    DateTime? ExpiresAt,
    string ApplicablePackageIds,   // JSON
    bool IsActive,
    DateTime CreatedAt
);

public sealed record CreateCouponRequest(
    string Code,
    string DiscountType,
    long DiscountValue,
    int MaxUsageCount,
    DateTime? ExpiresAt,
    string? ApplicablePackageIds,
    bool IsActive
);

public sealed record UpdateCouponRequest(
    string Code,
    string DiscountType,
    long DiscountValue,
    int MaxUsageCount,
    DateTime? ExpiresAt,
    string? ApplicablePackageIds,
    bool IsActive
);

// ══════════════════════════════════════════════════════════
// REVENUE DTOs
// ══════════════════════════════════════════════════════════
public sealed record RevenueStatsDto(
    long TotalRevenueToday,
    long TotalRevenueWeek,
    long TotalRevenueMonth,
    long TotalRevenueAll,
    int TotalTransactions,
    int SuccessfulTransactions,
    int FailedTransactions,
    int RefundedTransactions
);

public sealed record RevenueTimeSeriesPointDto(
    string Label,       // ngày/tuần/tháng
    long Revenue,
    int Count
);

public sealed record RevenueByPackageDto(
    Guid PackageId,
    string PackageName,
    long TotalRevenue,
    int TransactionCount
);
