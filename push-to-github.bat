@echo off
chcp 65001 > nul
echo.
echo ============================================
echo   رفع التطبيق إلى GitHub
echo ============================================
echo.
set /p REPO_URL="https://github.com/imx79/safety-app.git: "
echo.
cd /d "%~dp0"
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main
echo.
echo ============================================
echo   ✅ تم الرفع بنجاح!
echo   الآن اذهب إلى render.com لنشر التطبيق
echo ============================================
pause
