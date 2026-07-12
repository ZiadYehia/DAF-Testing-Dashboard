# Run this script as Administrator to set up SQL Server for the Testing Dashboard app.
# Right-click PowerShell → "Run as Administrator", then:
#   cd "C:\Users\Work\Desktop\Allendevaux Testing Dashboard"
#   .\scripts\setup-sqlserver.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== SQL Server Setup for Testing Dashboard ===" -ForegroundColor Cyan

# 1. Enable Mixed Mode Authentication in registry
Write-Host "`n[1/4] Enabling SQL Server Mixed Mode Authentication..." -ForegroundColor Yellow
$regPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer"
Set-ItemProperty -Path $regPath -Name LoginMode -Value 2
Write-Host "      LoginMode set to 2 (Mixed Mode)" -ForegroundColor Green

# 2. Restart SQL Server to apply auth mode change
Write-Host "`n[2/4] Restarting SQL Server (SQLEXPRESS)..." -ForegroundColor Yellow
Restart-Service -Name "MSSQL`$SQLEXPRESS" -Force
Start-Sleep -Seconds 5
Write-Host "      SQL Server restarted" -ForegroundColor Green

# 3. Enable sa account and set password, create database
Write-Host "`n[3/4] Enabling sa account and creating TestingDashboard database..." -ForegroundColor Yellow
$sql = @"
-- Enable sa login with password
ALTER LOGIN sa ENABLE;
ALTER LOGIN sa WITH PASSWORD = 'Allendevaux2026!';

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'TestingDashboard')
BEGIN
    CREATE DATABASE TestingDashboard;
    PRINT 'Created TestingDashboard database';
END
ELSE
BEGIN
    PRINT 'TestingDashboard database already exists';
END
"@
sqlcmd -S localhost -E -C -Q $sql
Write-Host "      sa account enabled, TestingDashboard database ready" -ForegroundColor Green

# 4. Grant sa access to TestingDashboard
Write-Host "`n[4/4] Granting sa access to TestingDashboard..." -ForegroundColor Yellow
$sql2 = @"
USE TestingDashboard;
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'sa')
BEGIN
    CREATE USER sa FOR LOGIN sa;
END
ALTER ROLE db_owner ADD MEMBER sa;
PRINT 'sa granted db_owner on TestingDashboard';
"@
sqlcmd -S localhost -E -C -Q $sql2
Write-Host "      Done" -ForegroundColor Green

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "SQL Server is now configured for Mixed Mode Auth." -ForegroundColor White
Write-Host "sa password: Allendevaux2026!" -ForegroundColor White
Write-Host "Database: TestingDashboard" -ForegroundColor White
Write-Host "`nRestart 'npm run dev' — the app will auto-create tables on first request." -ForegroundColor Yellow
