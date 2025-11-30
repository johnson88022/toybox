# 部署指南

本專案使用 Firebase Hosting 進行部署。

## 前置需求

1. **Node.js** (建議 18.x 或更高版本)
2. **Firebase CLI** - 需要先安裝
3. **Gemini API Key** - 用於 AI 功能

## 安裝步驟

### 1. 安裝依賴套件

```bash
npm install
```

### 2. 安裝 Firebase CLI

```bash
npm install -g firebase-tools
```

### 3. 登入 Firebase

```bash
firebase login
```

### 4. 設置環境變數

創建 `.env.local` 檔案並設置您的 Gemini API Key:

```bash
# 複製範例檔案
copy .env.example .env.local

# 編輯 .env.local 並填入您的 GEMINI_API_KEY
```

或者在 Windows 上:
```powershell
copy .env.example .env.local
# 然後用文字編輯器編輯 .env.local
```

### 5. 建置專案

```bash
npm run build
```

這會產生 `dist` 資料夾，包含準備部署的靜態檔案。

### 6. 部署到 Firebase Hosting

```bash
# 預覽部署內容
firebase deploy --only hosting

# 或者使用部署腳本
npm run deploy
```

## 部署腳本

專案已包含以下部署相關腳本：

- `npm run dev` - 本地開發伺服器 (port 3000)
- `npm run build` - 建置生產版本
- `npm run preview` - 預覽建置結果
- `npm run deploy` - 建置並部署到 Firebase Hosting

## 環境變數

在部署到 Firebase Hosting 時，環境變數需要在建置時注入。目前的配置會在 `vite.config.ts` 中讀取 `.env.local` 檔案。

如果需要在 Firebase Hosting 上使用環境變數，您可以：

1. 在 Vite 建置時設置環境變數
2. 或使用 Firebase Functions 來處理需要 API Key 的請求

## 故障排除

### 如果遇到 Firebase 認證問題

```bash
firebase logout
firebase login
```

### 如果專案 ID 不正確

編輯 `.firebaserc` 檔案，確保 `default` 專案 ID 與您的 Firebase 專案 ID 一致。

### 如果建置失敗

確保所有依賴都已安裝：
```bash
rm -rf node_modules package-lock.json
npm install
```

## 本地測試部署

在部署前，您可以使用以下命令測試建置結果：

```bash
npm run build
npm run preview
```

這會在本地啟動一個預覽伺服器，讓您檢查建置後的應用是否正常運作。

