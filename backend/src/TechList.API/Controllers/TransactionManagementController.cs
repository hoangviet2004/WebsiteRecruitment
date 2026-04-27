using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Admin.Interfaces;
using TechList.Application.Admin.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public sealed class TransactionManagementController : ControllerBase
{
    private readonly ITransactionManagementService _service;

    public TransactionManagementController(ITransactionManagementService service)
    {
        _service = service;
    }

    private string GetAdminUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new UnauthorizedAccessException();

    // ══════════════════════════════════════════════════════════
    // PACKAGES
    // ══════════════════════════════════════════════════════════

    [HttpGet("packages")]
    public async Task<ActionResult<ApiResponse<List<PackageDto>>>> GetPackages(CancellationToken ct)
    {
        var result = await _service.GetAllPackagesAsync(ct);
        return Ok(ApiResponse<List<PackageDto>>.Ok(result));
    }

    [HttpPost("packages")]
    public async Task<ActionResult<ApiResponse<PackageDto>>> CreatePackage(
        [FromBody] CreatePackageRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(ApiResponse<PackageDto>.Fail("Tên gói không được để trống"));

        var result = await _service.CreatePackageAsync(request, ct);
        return Ok(ApiResponse<PackageDto>.Ok(result, "Tạo gói dịch vụ thành công"));
    }

    [HttpPut("packages/{id:guid}")]
    public async Task<ActionResult<ApiResponse<PackageDto>>> UpdatePackage(
        Guid id, [FromBody] UpdatePackageRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(ApiResponse<PackageDto>.Fail("Tên gói không được để trống"));

        var result = await _service.UpdatePackageAsync(id, request, ct);
        return Ok(ApiResponse<PackageDto>.Ok(result, "Cập nhật gói dịch vụ thành công"));
    }

    [HttpDelete("packages/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> DeletePackage(Guid id, CancellationToken ct)
    {
        await _service.DeletePackageAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Xóa gói dịch vụ thành công"));
    }

    // ══════════════════════════════════════════════════════════
    // SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════════

    [HttpGet("subscriptions")]
    public async Task<ActionResult<ApiResponse<List<SubscriptionDto>>>> GetSubscriptions(
        [FromQuery] string? status, [FromQuery] string? search, CancellationToken ct)
    {
        var result = await _service.GetSubscriptionsAsync(status, search, ct);
        return Ok(ApiResponse<List<SubscriptionDto>>.Ok(result));
    }

    [HttpPut("subscriptions/{id:guid}/extend")]
    public async Task<ActionResult<ApiResponse<object>>> ExtendSubscription(
        Guid id, [FromBody] ExtendSubscriptionRequest request, CancellationToken ct)
    {
        if (request.ExtraDays <= 0)
            return BadRequest(ApiResponse<object>.Fail("Số ngày gia hạn phải > 0"));

        await _service.ExtendSubscriptionAsync(id, request.ExtraDays, GetAdminUserId(), ct);
        return Ok(ApiResponse<object>.Ok(null!, "Gia hạn subscription thành công"));
    }

    [HttpPut("subscriptions/{id:guid}/revoke")]
    public async Task<ActionResult<ApiResponse<object>>> RevokeSubscription(Guid id, CancellationToken ct)
    {
        await _service.RevokeSubscriptionAsync(id, GetAdminUserId(), ct);
        return Ok(ApiResponse<object>.Ok(null!, "Thu hồi subscription thành công"));
    }

    [HttpPut("subscriptions/{id:guid}/change-package")]
    public async Task<ActionResult<ApiResponse<object>>> ChangePackage(
        Guid id, [FromBody] ChangePackageRequest request, CancellationToken ct)
    {
        await _service.ChangeSubscriptionPackageAsync(id, request.NewPackageId, GetAdminUserId(), ct);
        return Ok(ApiResponse<object>.Ok(null!, "Chuyển gói thành công"));
    }

    // ══════════════════════════════════════════════════════════
    // TRANSACTIONS
    // ══════════════════════════════════════════════════════════

    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<PagedResult<TransactionDto>>>> GetTransactions(
        [FromQuery] string? status,
        [FromQuery] string? paymentMethod,
        [FromQuery] string? companyName,
        [FromQuery] string? searchTerm,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var filter = new TransactionFilterDto(status, paymentMethod, companyName, searchTerm, fromDate, toDate, page, pageSize);
        var result = await _service.GetTransactionsAsync(filter, ct);
        return Ok(ApiResponse<PagedResult<TransactionDto>>.Ok(result));
    }

    [HttpGet("transactions/{id:guid}")]
    public async Task<ActionResult<ApiResponse<TransactionDetailDto>>> GetTransaction(Guid id, CancellationToken ct)
    {
        var result = await _service.GetTransactionByIdAsync(id, ct);
        return Ok(ApiResponse<TransactionDetailDto>.Ok(result));
    }

    [HttpPost("transactions/{id:guid}/refund")]
    public async Task<ActionResult<ApiResponse<object>>> RefundTransaction(
        Guid id, [FromBody] RefundRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(ApiResponse<object>.Fail("Lý do hoàn tiền không được để trống"));

        await _service.RefundTransactionAsync(id, request.Reason, GetAdminUserId(), ct);
        return Ok(ApiResponse<object>.Ok(null!, "Hoàn tiền thành công"));
    }

    // ══════════════════════════════════════════════════════════
    // COUPONS
    // ══════════════════════════════════════════════════════════

    [HttpGet("coupons")]
    public async Task<ActionResult<ApiResponse<List<CouponDto>>>> GetCoupons(CancellationToken ct)
    {
        var result = await _service.GetAllCouponsAsync(ct);
        return Ok(ApiResponse<List<CouponDto>>.Ok(result));
    }

    [HttpPost("coupons")]
    public async Task<ActionResult<ApiResponse<CouponDto>>> CreateCoupon(
        [FromBody] CreateCouponRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(ApiResponse<CouponDto>.Fail("Mã giảm giá không được để trống"));

        var result = await _service.CreateCouponAsync(request, ct);
        return Ok(ApiResponse<CouponDto>.Ok(result, "Tạo mã giảm giá thành công"));
    }

    [HttpPut("coupons/{id:guid}")]
    public async Task<ActionResult<ApiResponse<CouponDto>>> UpdateCoupon(
        Guid id, [FromBody] UpdateCouponRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateCouponAsync(id, request, ct);
        return Ok(ApiResponse<CouponDto>.Ok(result, "Cập nhật mã giảm giá thành công"));
    }

    [HttpDelete("coupons/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteCoupon(Guid id, CancellationToken ct)
    {
        await _service.DeleteCouponAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Xóa mã giảm giá thành công"));
    }

    // ══════════════════════════════════════════════════════════
    // REVENUE STATISTICS
    // ══════════════════════════════════════════════════════════

    [HttpGet("revenue/stats")]
    public async Task<ActionResult<ApiResponse<RevenueStatsDto>>> GetRevenueStats(CancellationToken ct)
    {
        var result = await _service.GetRevenueStatsAsync(ct);
        return Ok(ApiResponse<RevenueStatsDto>.Ok(result));
    }

    [HttpGet("revenue/timeseries")]
    public async Task<ActionResult<ApiResponse<List<RevenueTimeSeriesPointDto>>>> GetRevenueTimeSeries(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var end   = string.IsNullOrWhiteSpace(endDate)   ? DateTime.UtcNow : DateTime.Parse(endDate).ToUniversalTime();
        var start = string.IsNullOrWhiteSpace(startDate) ? end.AddDays(-30)  : DateTime.Parse(startDate).ToUniversalTime();
        var days  = (end - start).TotalDays;
        var period = days <= 14 ? "day" : days <= 90 ? "week" : "month";

        var result = await _service.GetRevenueTimeSeriesAsync(start, end, period, ct);
        return Ok(ApiResponse<List<RevenueTimeSeriesPointDto>>.Ok(result));
    }

    [HttpGet("revenue/by-package")]
    public async Task<ActionResult<ApiResponse<List<RevenueByPackageDto>>>> GetRevenueByPackage(CancellationToken ct)
    {
        var result = await _service.GetRevenueByPackageAsync(ct);
        return Ok(ApiResponse<List<RevenueByPackageDto>>.Ok(result));
    }
}
