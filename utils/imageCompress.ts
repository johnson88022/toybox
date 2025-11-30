/**
 * 壓縮圖片並轉換為 base64
 * 目標：將圖片壓縮到 500KB 以下，確保可以存到 Firestore
 */
export const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // 計算新尺寸
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          } else {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        // 創建 canvas 進行壓縮
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('無法創建 canvas context'));
          return;
        }
        
        // 繪製圖片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 轉換為 base64，嘗試不同的品質直到符合大小限制
        // 考慮多張圖片的情況，單張圖片限制更嚴格（約150KB，確保3-4張圖片不超過1MB）
        let currentQuality = quality;
        const maxSize = 150 * 1024; // 150KB per image (確保多張圖片時總大小不超過1MB)
        let base64 = '';
        
        const tryCompress = () => {
          base64 = canvas.toDataURL('image/jpeg', currentQuality);
          const size = (base64.length * 3) / 4; // base64 大小估算
          
          if (size > maxSize && currentQuality > 0.2) {
            // 如果還是太大，降低品質
            currentQuality -= 0.1;
            tryCompress();
          } else {
            console.log(`圖片壓縮完成: 原始 ${(file.size / 1024).toFixed(2)}KB, 壓縮後 ${(size / 1024).toFixed(2)}KB, 品質 ${currentQuality.toFixed(2)}`);
            resolve(base64);
          }
        };
        
        tryCompress();
      };
      
      img.onerror = () => {
        reject(new Error('圖片載入失敗'));
      };
      
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('無法讀取檔案'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('檔案讀取失敗'));
    };
    
    reader.readAsDataURL(file);
  });
};

