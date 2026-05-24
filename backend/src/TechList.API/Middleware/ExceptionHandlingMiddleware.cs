using System.Net;
using TechList.API.Common;

namespace TechList.API.Middleware;

public sealed class ExceptionHandlingMiddleware : IMiddleware
{
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(ILogger<ExceptionHandlingMiddleware> logger)
    {
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized request");
            await WriteAsync(context, HttpStatusCode.Unauthorized, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Business rule violation");
            await WriteAsync(context, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (OperationCanceledException ex)
        {
            if (context.RequestAborted.IsCancellationRequested)
            {
                _logger.LogInformation("Yêu cầu đã bị hủy bởi người dùng.");
                context.Response.StatusCode = 499; // Client Closed Request
            }
            else
            {
                _logger.LogWarning(ex, "Yêu cầu đã bị quá thời gian xử lý.");
                await WriteAsync(context, HttpStatusCode.RequestTimeout, "Yêu cầu đã bị quá thời gian xử lý, vui lòng thử lại sau.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await WriteAsync(context, HttpStatusCode.InternalServerError, "Đã xảy ra lỗi, vui lòng thử lại sau.");
        }
    }

    private static Task WriteAsync(HttpContext ctx, HttpStatusCode code, string message)
    {
        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode = (int)code;
        return ctx.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message));
    }
}

