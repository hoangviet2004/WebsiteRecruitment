-- 1. Check & create database
IF NOT EXISTS (
    SELECT name 
    FROM sys.databases 
    WHERE name = N'TechList'
)
BEGIN
    PRINT 'Đang tạo database TechList.';
    CREATE DATABASE TechList;
END
ELSE
BEGIN
    PRINT 'Database TechList đã tồn tại.';
END
GO

-- 2. Switch to TechList
USE TechList;
GO