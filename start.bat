@echo off
chcp 65001 >nul
title نظام إدارة الأمن والسلامة
echo.
echo ===================================================
echo    نظام إدارة الأمن والسلامة - بدء التشغيل
echo ===================================================
echo.

REM التحقق من Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت
    echo حمّله من: https://nodejs.org
    pause
    exit /b
)

REM التحقق من تثبيت التبعيات
if not exist "node_modules" (
    echo [+] جاري تثبيت التبعيات لأول مرة...
    call npm install
    if errorlevel 1 (
        echo [خطأ] فشل تثبيت التبعيات
        pause
        exit /b
    )
)

echo.
echo [+] جاري تشغيل الخادم...
echo [+] افتح المتصفح على: http://localhost:3000
echo [+] الحساب الافتراضي: admin / admin123
echo.
node server.js
pause
