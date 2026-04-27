-- ══════════════════════════════════════════════════════════
-- Transaction Management — Migration Script
-- Database: SQL Server / TechList
-- ══════════════════════════════════════════════════════════

BEGIN TRANSACTION;

-- ── 1. ServicePackages ───────────────────────────────────
IF OBJECT_ID(N'ServicePackages') IS NULL
BEGIN
    CREATE TABLE [ServicePackages] (
        [Id]            uniqueidentifier NOT NULL DEFAULT NEWID(),
        [Name]          nvarchar(100)    NOT NULL,
        [Price]         bigint           NOT NULL DEFAULT 0,
        [MaxJobPosts]   int              NOT NULL DEFAULT 0,
        [DurationDays]  int              NOT NULL DEFAULT 30,
        [Features]      nvarchar(4000)   NOT NULL DEFAULT '[]',
        [IsHighlighted] bit              NOT NULL DEFAULT 0,
        [IsActive]      bit              NOT NULL DEFAULT 1,
        [DisplayOrder]  int              NOT NULL DEFAULT 0,
        [CreatedAt]     datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_ServicePackages] PRIMARY KEY ([Id])
    );
    PRINT 'Created table: ServicePackages';
END;

-- ── 2. Subscriptions ─────────────────────────────────────
IF OBJECT_ID(N'Subscriptions') IS NULL
BEGIN
    CREATE TABLE [Subscriptions] (
        [Id]           uniqueidentifier NOT NULL DEFAULT NEWID(),
        [UserId]       nvarchar(450)    NOT NULL,
        [PackageId]    uniqueidentifier NOT NULL,
        [StartDate]    datetime2        NOT NULL,
        [EndDate]      datetime2        NOT NULL,
        [Status]       nvarchar(50)     NOT NULL DEFAULT 'Active',
        [JobPostsUsed] int              NOT NULL DEFAULT 0,
        [CreatedAt]    datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]    datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_Subscriptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Subscriptions_ServicePackages] FOREIGN KEY ([PackageId])
            REFERENCES [ServicePackages]([Id]) ON DELETE NO ACTION
    );

    CREATE INDEX [IX_Subscriptions_UserId_Status] ON [Subscriptions] ([UserId], [Status]);
    PRINT 'Created table: Subscriptions';
END;

-- ── 3. Coupons ───────────────────────────────────────────
IF OBJECT_ID(N'Coupons') IS NULL
BEGIN
    CREATE TABLE [Coupons] (
        [Id]                   uniqueidentifier NOT NULL DEFAULT NEWID(),
        [Code]                 nvarchar(50)     NOT NULL,
        [DiscountType]         nvarchar(50)     NOT NULL DEFAULT 'Percentage',
        [DiscountValue]        bigint           NOT NULL DEFAULT 0,
        [MaxUsageCount]        int              NOT NULL DEFAULT 0,
        [CurrentUsageCount]    int              NOT NULL DEFAULT 0,
        [ExpiresAt]            datetime2        NULL,
        [ApplicablePackageIds] nvarchar(2000)   NOT NULL DEFAULT '[]',
        [IsActive]             bit              NOT NULL DEFAULT 1,
        [CreatedAt]            datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_Coupons] PRIMARY KEY ([Id])
    );

    CREATE UNIQUE INDEX [IX_Coupons_Code] ON [Coupons] ([Code]);
    PRINT 'Created table: Coupons';
END;

-- ── 4. Transactions ──────────────────────────────────────
IF OBJECT_ID(N'Transactions') IS NULL
BEGIN
    CREATE TABLE [Transactions] (
        [Id]                uniqueidentifier NOT NULL DEFAULT NEWID(),
        [TransactionCode]   nvarchar(50)     NOT NULL,
        [UserId]            nvarchar(450)    NOT NULL,
        [CompanyName]       nvarchar(200)    NOT NULL DEFAULT '',
        [PackageId]         uniqueidentifier NOT NULL,
        [Amount]            bigint           NOT NULL DEFAULT 0,
        [DiscountAmount]    bigint           NOT NULL DEFAULT 0,
        [FinalAmount]       bigint           NOT NULL DEFAULT 0,
        [CouponId]          uniqueidentifier NULL,
        [PaymentMethod]     nvarchar(50)     NOT NULL DEFAULT 'VNPay',
        [Status]            nvarchar(50)     NOT NULL DEFAULT 'Pending',
        [PaymentGatewayRef] nvarchar(200)    NULL,
        [StatusHistory]     nvarchar(4000)   NOT NULL DEFAULT '[]',
        [RefundReason]      nvarchar(1000)   NULL,
        [RefundedBy]        nvarchar(450)    NULL,
        [CreatedAt]         datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]         datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_Transactions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Transactions_ServicePackages] FOREIGN KEY ([PackageId])
            REFERENCES [ServicePackages]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Transactions_Coupons] FOREIGN KEY ([CouponId])
            REFERENCES [Coupons]([Id]) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX [IX_Transactions_TransactionCode] ON [Transactions] ([TransactionCode]);
    CREATE INDEX [IX_Transactions_Status]    ON [Transactions] ([Status]);
    CREATE INDEX [IX_Transactions_CreatedAt] ON [Transactions] ([CreatedAt]);
    PRINT 'Created table: Transactions';
END;

-- ── 5. AuditLogs ─────────────────────────────────────────
IF OBJECT_ID(N'AuditLogs') IS NULL
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id]          uniqueidentifier NOT NULL DEFAULT NEWID(),
        [Action]      nvarchar(100)    NOT NULL,
        [EntityType]  nvarchar(100)    NOT NULL,
        [EntityId]    nvarchar(450)    NOT NULL,
        [PerformedBy] nvarchar(450)    NOT NULL,
        [Details]     nvarchar(4000)   NULL,
        [CreatedAt]   datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id])
    );

    CREATE INDEX [IX_AuditLogs_CreatedAt] ON [AuditLogs] ([CreatedAt]);
    PRINT 'Created table: AuditLogs';
END;

-- ══════════════════════════════════════════════════════════
-- SEED DATA — 4 gói dịch vụ mặc định
-- ══════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM [ServicePackages])
BEGIN
    INSERT INTO [ServicePackages] ([Id], [Name], [Price], [MaxJobPosts], [DurationDays], [Features], [IsHighlighted], [IsActive], [DisplayOrder])
    VALUES
    (NEWID(), N'Free',    0,       3,  30,
     N'["3 tin tuyển dụng/tháng","Hiển thị cơ bản","Hỗ trợ qua email"]',
     0, 1, 1),

    (NEWID(), N'Basic',   299000,  10, 30,
     N'["10 tin tuyển dụng/tháng","Hiển thị ưu tiên","Xem hồ sơ ứng viên","Hỗ trợ qua email và chat"]',
     0, 1, 2),

    (NEWID(), N'Pro',     699000,  30, 30,
     N'["30 tin tuyển dụng/tháng","Hiển thị nổi bật","Xem & tải hồ sơ ứng viên","Thống kê chi tiết","Hỗ trợ ưu tiên 24/7"]',
     1, 1, 3),

    (NEWID(), N'Premium', 1299000, -1, 30,
     N'["Không giới hạn tin tuyển dụng","Hiển thị VIP trên trang chủ","Toàn quyền xem hồ sơ ứng viên","Thống kê nâng cao","Tài khoản quản lý đa người dùng","Hỗ trợ chuyên viên riêng"]',
     0, 1, 4);

    PRINT 'Seeded 4 default service packages';
END;

COMMIT;
GO

PRINT '✅ Transaction Management migration completed successfully!';
GO
