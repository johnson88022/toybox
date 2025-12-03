import React, { useState } from 'react';
import { Sparkles, Download, AlertCircle, ShoppingBag, Wand2 } from 'lucide-react';
import { generateFigureImage } from '../services/geminiService';
import { ImageSize, Product } from '../types';

interface DreamFactoryProps {
  onAddToCart: (product: Product) => void;
  onSubmitWish: (wish: string) => void;
}

const DreamFactory: React.FC<DreamFactoryProps> = ({ onAddToCart, onSubmitWish }) => {
  const [wish, setWish] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleWish = (e: React.FormEvent) => {
    e.preventDefault();
    const wishText = wish.trim();
    if(wishText.length === 0) {
      setError('請描述您希望買到什麼商品！');
      return;
    }
    setError(null);
    onSubmitWish(wishText);
    setIsSuccess(true);
    setWish('');
  };
  const remaining = 120 - wish.trim().length;

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-cute-bg">
      <div className="max-w-3xl mx-auto">
        {/* 頂部說明區 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl mb-4 shadow-sm border border-gray-100">
            <Sparkles className="w-8 h-8 text-cute-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-cute-text mb-3 tracking-tight">
            買家許願池
          </h1>
          <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto font-medium">
            把你心中的「理想公仔」說出來，留下系列、角色、尺寸或風格，
            我們會整理熱門許願，優先安排上架與客製提案。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
          {/* 許願表單卡片 */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 md:p-8">
            {isSuccess ? (
              <div className="text-center py-10">
                <div className="w-full flex justify-center mb-4">
                  <Sparkles className="w-10 h-10 text-cute-secondary animate-bounce" />
                </div>
                <p className="text-2xl font-extrabold text-gray-800 mb-2">許願成功！</p>
                <p className="text-gray-500 text-sm md:text-base">
                  感謝你的靈感，我們會把這些願望整理給賣家與站長，
                  一起評估能不能把它變成真的作品。
                </p>
                <button
                  className="mt-8 px-10 py-3 bg-cute-primary text-white font-bold rounded-full hover:bg-pink-500 hover:shadow-md transition-all"
                  onClick={() => setIsSuccess(false)}
                >
                  再許一個願 ✨
                </button>
              </div>
            ) : (
              <form onSubmit={handleWish} className="flex flex-col gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-800">
                      我想在 ToyBox 買到...
                    </label>
                    <span className="text-[11px] md:text-xs text-gray-500">
                      建議 1～2 句，越具體越好
                    </span>
                  </div>
                  <textarea
                    value={wish}
                    onChange={(e) => setWish(e.target.value)}
                    placeholder="範例：想要《咒術迴戰》狗卷學長 1/7 比例公仔，動作帥一點、底座有咒言特效。"
                    className="w-full min-h-[140px] bg-gray-50 text-gray-800 rounded-2xl p-4 border border-gray-200 focus:border-cute-primary focus:ring-2 focus:ring-pink-100 focus:outline-none resize-none transition-all text-sm md:text-base"
                  />
                  <div className="flex items-center justify-between text-[11px] md:text-xs">
                    <span className={`font-medium ${remaining < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      還可以輸入 {Math.max(0, remaining)} 字
                    </span>
                    {error && <span className="text-red-500 font-bold">{error}</span>}
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3.5 bg-cute-primary rounded-full text-white font-bold text-base md:text-lg flex items-center justify-center gap-2 hover:bg-pink-500 hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!wish.trim() || remaining < -20}
                >
                  <Sparkles className="w-5 h-5" />
                  送出願望
                </button>
              </form>
            )}
          </div>

          {/* 右側說明 / 小卡區 */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cute-primary" />
                怎樣的願望比較容易成真？
              </h2>
              <ul className="space-y-2 text-xs md:text-sm text-gray-600">
                <li>・寫清楚作品名稱、角色、尺寸（例如 1/7、1/4）</li>
                <li>・可以補充「表情、姿勢、場景、特效」等細節</li>
                <li>・如果是原創概念，可以描述顏色風格、氛圍感</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-3xl border border-gray-100 p-4 text-xs md:text-sm text-gray-700">
              <p className="font-bold mb-1">小提醒</p>
              <p>許願內容僅作為商品開發與進貨參考，不會直接視為訂單。若真的開發出來，我們會在首頁與社群公告！</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DreamFactory;