@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   نشر تطبيق السلامة على Railway
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] تهيئة مستودع git...
git init
git add -A
git commit -m "Initial deploy" --allow-empty 2>nul || git commit -m "Update" -a

echo.
echo [2/4] تسجيل الدخول في Railway (سيفتح المتصفح)...
railway login

echo.
echo [3/4] إنشاء مشروع جديد...
railway init

echo.
echo [4/4] رفع التطبيق...
railway up --detach

echo.
echo ========================================
echo   لمعرفة رابط التطبيق شغّل الأمر:
echo   railway domain
echo ========================================
pause
