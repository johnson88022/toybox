#!/bin/bash
# 部署腳本

echo "=== CyberCollector 部署腳本 ==="
echo ""

# 檢查 Firebase 登入狀態
echo "檢查 Firebase 登入狀態..."
if firebase projects:list &> /dev/null; then
    echo "✓ 已登入 Firebase"
else
    echo "需要登入 Firebase..."
    firebase login
fi

# 建置專案
echo ""
echo "建置專案..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ 建置成功"
else
    echo "✗ 建置失敗"
    exit 1
fi

# 部署到 Firebase Hosting
echo ""
echo "部署到 Firebase Hosting..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ 部署成功！"
    echo "您的應用程式已部署到 Firebase Hosting"
else
    echo ""
    echo "✗ 部署失敗"
    exit 1
fi

