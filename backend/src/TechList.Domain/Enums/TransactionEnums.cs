namespace TechList.Domain.Enums;

/// <summary>Trạng thái giao dịch thanh toán.</summary>
public static class TransactionStatus
{
    public const string Pending  = "Pending";
    public const string Success  = "Success";
    public const string Failed   = "Failed";
    public const string Refunded = "Refunded";

    public static readonly string[] All = [Pending, Success, Failed, Refunded];
}

/// <summary>Phương thức thanh toán.</summary>
public static class PaymentMethod
{
    public const string VNPay  = "VNPay";
    public const string Momo   = "Momo";
    public const string Stripe = "Stripe";
    public const string Manual = "Manual"; // Admin cấp thủ công

    public static readonly string[] All = [VNPay, Momo, Stripe, Manual];
}

/// <summary>Loại giảm giá.</summary>
public static class DiscountType
{
    public const string Percentage  = "Percentage";
    public const string FixedAmount = "FixedAmount";
}

/// <summary>Trạng thái subscription.</summary>
public static class SubscriptionStatus
{
    public const string Active  = "Active";
    public const string Expired = "Expired";
    public const string Revoked = "Revoked";

    public static readonly string[] All = [Active, Expired, Revoked];
}
