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
  return (
    <div className="min-h-screen pt-28 pb-12 px-4 bg-cute-bg">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-full mb-6 shadow-md">
            <Sparkles className="w-10 h-10 text-cute-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-cute-text mb-4 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cute-primary to-cute-secondary">買家許願池</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto font-medium">
            想買但市面上還沒看到？歡迎許願您夢想中的商品，讓更多人一起集氣，賣家與站長會定期收集製作！
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-pink-100 shadow-xl p-8 mx-auto w-full max-w-lg">
          {isSuccess ? (
            <div className="text-center py-12">
              <div className="w-full flex justify-center mb-4">
                <Sparkles className="w-12 h-12 text-cute-secondary animate-bounce" />
              </div>
              <p className="text-2xl font-extrabold text-cute-primary mb-4">許願成功！</p>
              <span className="text-gray-500">感謝您的寶貴意見，大家的集氣許願會帶來新商品～</span>
              <button className="mt-8 btn px-8 py-3 bg-cute-secondary text-white font-bold rounded-full hover:bg-cute-primary transition" onClick={()=>setIsSuccess(false)}>再許一個願</button>
            </div>
          ) : (
          <form onSubmit={handleWish} className="flex flex-col gap-6">
            <div>
              <label className="block text-md font-bold text-gray-600 mb-2">我想在 ToyBox 買到...</label>
              <textarea
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="請描述你希望看到什麼產品，例如：動畫xxx的主角模型，或某主題場景..."
                className="w-full h-32 bg-gray-50 text-gray-800 rounded-2xl p-4 border border-pink-100 focus:border-cute-primary focus:ring-2 focus:ring-pink-100 focus:outline-none resize-none transition-all"
              />
            </div>
            {error && <div className="text-red-500 font-bold">{error}</div>}
            <button 
              type="submit" 
              className="w-full py-4 bg-cute-primary rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-pink-400 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!wish.trim()}
            >
              許 願
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DreamFactory;