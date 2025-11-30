@echo off
REM 部署腳本 (Windows)

echo === CyberCollector 部署腳本 ===
echo.

REM 檢查 Firebase 登入狀態
echo 檢查 Firebase 登入狀態...
firebase projects:list >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 已登入 Firebase
) else (
    echo 需要登入 Firebase...
    firebase login
)

REM 建置專案
echo.
echo 建置專案...
call npm run build

if %errorlevel% neq 0 (
    echo [錯誤] 建置失敗
    exit /b 1
)

echo [OK] 建置成功

REM 部署到 Firebase Hosting
echo.
echo 部署到 Firebase Hosting...
call firebase deploy --only hosting

if %errorlevel% equ 0 (
    echo.
    echo [OK] 部署成功！
    echo 您的應用程式已部署到 Firebase Hosting
) else (
    echo.
    echo [錯誤] 部署失敗
    exit /b 1
)

