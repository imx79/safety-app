#!/bin/bash
echo "==================================================="
echo "   نظام إدارة الأمن والسلامة - بدء التشغيل"
echo "==================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "[خطأ] Node.js غير مثبت"
    echo "حمّله من: https://nodejs.org"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[+] جاري تثبيت التبعيات لأول مرة..."
    npm install
fi

echo ""
echo "[+] جاري تشغيل الخادم..."
echo "[+] افتح المتصفح على: http://localhost:3000"
echo "[+] الحساب الافتراضي: admin / admin123"
echo ""
node server.js
