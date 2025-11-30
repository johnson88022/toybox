# 快速部署指南

## ✅ 已完成的工作

1. ✅ 安裝項目依賴 (`npm install`)
2. ✅ 安裝 Firebase CLI (`npm install -g firebase-tools`)
3. ✅ 創建 Firebase 配置文件 (`firebase.json`, `.firebaserc`)
4. ✅ 建置專案 (`npm run build` - 已成功)
5. ✅ 添加部署腳本到 `package.json`

## 🚀 接下來需要您完成的步驟

### 步驟 1: 登入 Firebase

開啟終端機並執行：

```bash
firebase login
```

這會開啟瀏覽器讓您登入 Google 帳號（需要與 Firebase 專案相關聯的帳號）。

### 步驟 2: 確認專案 ID

確認 `.firebaserc` 檔案中的專案 ID 是否正確：
- 目前設定：`auth-9054b`
- 如果需要更改，請編輯 `.firebaserc` 檔案

### 步驟 3: 設置環境變數（可選，但建議）

如果您的應用需要 Gemini API Key，請創建 `.env.local` 檔案：

1. 複製 `env.example.txt` 為 `.env.local`
2. 編輯 `.env.local` 並填入您的 `GEMINI_API_KEY`

### 步驟 4: 執行部署

選擇以下任一方式：

**方式 1: 使用 npm 腳本（推薦）**
```bash
npm run deploy
```

**方式 2: 使用 Windows 批次檔**
```bash
deploy.bat
```

**方式 3: 手動執行**
```bash
# 先建置（如果還沒建置）
npm run build

# 然後部署
firebase deploy --only hosting
```

## 📝 部署後

部署成功後，Firebase 會提供一個 URL，類似：
- `https://auth-9054b.web.app`
- `https://auth-9054b.firebaseapp.com`

您可以在 Firebase Console 中查看部署狀態和設定自訂網域。

## 🔧 故障排除

### 如果登入失敗
```bash
firebase logout
firebase login
```

### 如果專案 ID 錯誤
編輯 `.firebaserc` 檔案，將專案 ID 改為正確的值。

### 如果建置失敗
確保環境變數已設置（如果需要），然後重新建置：
```bash
npm run build
```

### 如果需要重新部署
```bash
npm run deploy
```

## 📚 更多資訊

詳細的部署說明請參考 `DEPLOY.md` 檔案。

