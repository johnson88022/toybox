import React, { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity?: number) => void;
  onClick?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showQty, setShowQty] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Category translation helper
  const translateCategory = (cat: string) => {
    switch(cat) {
      case 'Sci-Fi': return '科幻';
      case 'Fantasy': return '奇幻';
      case 'Anime': return '動漫';
      case 'Custom': return '客製化';
      default: return cat;
    }
  };

  return (
    <div 
      className="group relative bg-white rounded-3xl overflow-hidden border border-pink-100 transition-all duration-300 hover:shadow-xl hover:shadow-pink-200/50 hover:-translate-y-2 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {product.isNew && (
        <div className="absolute top-4 left-4 z-10 bg-cute-secondary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
          新品 ✨
        </div>
      )}
      
      <div className="relative h-72 overflow-hidden bg-gray-50">
        <img 
          src={product.images && product.images.length > 0 ? product.images[0] : product.image} 
          alt={product.name} 
          className={`w-full h-full ${product.imageFit === 'cover' ? 'object-cover' : 'object-contain'} transition-transform duration-700 ${isHovered ? 'scale-110' : 'scale-100'}`}
        />
        <div className={`absolute inset-0 bg-white/20 backdrop-blur-[2px] flex flex-col items-center justify-center transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          {showQty ? (
            <div className="bg-white p-4 rounded-2xl shadow-lg flex flex-col items-center">
              <div className="mb-2 font-bold text-cute-primary">選擇數量</div>
              <div className="flex items-center gap-2">
                <button className="bg-pink-100 text-xl px-3 rounded-full" onClick={()=>setQuantity(q=>Math.max(1,q-1))} aria-label="減少數量">-</button>
                <input 
                  type="number" 
                  min={1} 
                  value={quantity} 
                  className="border-2 border-cute-primary w-12 text-center rounded-md" 
                  onChange={e => setQuantity(Math.max(1,parseInt(e.target.value)||1))}
                  aria-label="商品數量"
                />
                <button className="bg-green-100 text-xl px-3 rounded-full" onClick={()=>setQuantity(q=>q+1)} aria-label="增加數量">+</button>
              </div>
              <button 
                className="mt-3 bg-cute-primary text-white font-bold px-6 py-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={()=>{
                  if (quantity > product.stock) {
                    alert(`庫存不足！目前僅剩 ${product.stock} 件。`);
                    return;
                  }
                  onAddToCart(product, quantity); 
                  setShowQty(false); 
                  setQuantity(1);
                }}
                disabled={quantity > product.stock || product.stock === 0}
              >
                確定加入 {quantity > product.stock && '(庫存不足)'}
              </button>
              <button className="mt-1 text-gray-400 text-xs underline" onClick={()=>setShowQty(false)}>取消</button>
            </div>
          ) : (
          <button 
            onClick={() => setShowQty(true)}
            className="bg-white text-cute-primary font-bold py-3 px-8 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg hover:bg-cute-primary hover:text-white flex items-center gap-2 border-2 border-cute-primary"
          >
            <Plus size={20} />
            加入購物車
          </button>) }
        </div>
      </div>

      <div className="p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1" onClick={onClick} style={{ cursor: 'pointer' }}>
            <p className="text-cute-secondary text-xs font-bold uppercase tracking-wider mb-1">{translateCategory(product.category)}</p>
            <h3 className="text-cute-text font-bold text-xl leading-tight truncate pr-2">{product.name}</h3>
          </div>
          <div className="flex items-center text-yellow-400 gap-1 text-sm bg-yellow-50 px-2 py-1 rounded-lg">
            <Star size={14} fill="currentColor" />
            <span className="font-bold">{product.rating}</span>
          </div>
        </div>
        
        <p className="text-gray-400 text-sm line-clamp-2 mb-4 h-10 font-medium">{product.description}</p>
        
        <div className="flex items-center justify-between mt-4">
          <span className="text-2xl font-black text-cute-primary">${product.price.toFixed(2)}</span>
          <span className={`text-xs font-bold px-2 py-1 rounded-md ${product.stock === 0 ? 'bg-gray-100 text-gray-500' : product.stock < 5 ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
            {product.stock === 0 ? '缺貨' : product.stock < 5 ? `僅剩 ${product.stock} 件!` : `庫存: ${product.stock} 件`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;