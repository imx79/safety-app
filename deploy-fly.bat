@echo off
chcp 65001 > nul
set FLY=%USERPROFILE%\.fly\bin\flyctl.exe

echo.
echo ============================================
echo   نشر التطبيق على Fly.io
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] تسجيل الدخول (سيفتح المتصفح)...
"%FLY%" auth login

echo.
echo [2/3] تجهيز التطبيق...
"%FLY%" apps create safety-app-sa 2>nul
"%FLY%" volumes create safety_data --region dxb --size 1 --yes 2>nul

echo.
echo [3/3] بناء ونشر التطبيق (قد يستغرق 3-5 دقائق)...
"%FLY%" deploy --remote-only

echo.
echo ============================================
"%FLY%" status
echo.
echo   رابطك: https://safety-app-sa.fly.dev
echo ============================================
pause
