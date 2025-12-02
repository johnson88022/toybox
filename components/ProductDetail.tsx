import React, { useState } from 'react';
import { ArrowLeft, ShoppingCart, Star, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, User, Review } from '../types';
import { updateProduct } from '../firestoreHelpers';

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  user: User | null;
  products: Product[];
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onClose, onAddToCart, user, products }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 從 products 陣列中獲取最新的商品資料
  const currentProduct = products.find(p => p.id === product.id) || product;
  
  // 使用 currentProduct 的圖片
  const images = currentProduct.images && currentProduct.images.length > 0 
    ? currentProduct.images 
    : [currentProduct.image];

  const translateCategory = (cat: string) => {
    switch(cat) {
      case 'Sci-Fi': return '科幻';
      case 'Fantasy': return '奇幻';
      case 'Anime': return '動漫';
      case 'Custom': return '客製化';
      default: return cat;
    }
  };

  const handleAddToCart = () => {
    if (quantity > currentProduct.stock) {
      alert(`庫存不足！目前僅剩 ${currentProduct.stock} 件。`);
      return;
    }
    if (currentProduct.stock === 0) {
      alert('此商品目前缺貨！');
      return;
    }
    onAddToCart(currentProduct, quantity);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      alert('請先登入');
      return;
    }
    if (!reviewComment.trim()) {
      alert('請輸入評價內容');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const newReview: Review = {
        id: `review-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        rating: reviewRating,
        comment: reviewComment,
        date: new Date()
      };
      
      const updatedReviews = [...(currentProduct.reviews || []), newReview];
      const updatedProduct = {
        ...currentProduct,
        reviews: updatedReviews,
        rating: updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length
      };
      
      // 使用 updateProduct 直接更新（需要 id 和 updates）
      await updateProduct(currentProduct.id, updatedProduct);
      setReviewComment('');
      setReviewRating(5);
      alert('評價已提交！');
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('提交失敗，請重試');
    } finally {
      setIsSubmittingReview(false);
    }
  };


  return (
    <div className="min-h-screen pt-16 sm:pt-20 px-4 pb-12 bg-cute-bg fixed inset-0 overflow-y-auto z-50" style={{ touchAction: 'pan-y' }}>
      <div className="max-w-7xl mx-auto">
        {/* 返回按鈕 - 手機版減少頂部間距 */}
        <button
          onClick={onClose}
          className="mb-2 mt-0 sm:mb-4 sm:mt-2 flex items-center gap-2 text-gray-600 hover:text-gray-800 font-bold transition-colors text-sm sm:text-base"
        >
          <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">返回商品列表</span>
          <span className="sm:hidden">返回</span>
        </button>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl p-6 md:p-12 shadow-lg">
          {/* 左側：商品圖片 */}
          <div className="space-y-4">
            {/* 主圖 */}
            <div 
              className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden group cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'pan-x' }}
              onTouchStart={(e) => {
                // 只阻止圖片區域的默認滾動，允許橫向滑動
                const touch = e.targetTouches[0];
                setTouchStart(touch.clientX);
                setTouchEnd(null);
              }}
              onTouchMove={(e) => {
                // 允許橫向滑動，但阻止縱向滾動
                if (touchStart !== null) {
                  const touch = e.targetTouches[0];
                  const deltaX = Math.abs(touch.clientX - touchStart);
                  const deltaY = Math.abs(touch.clientY - (e.targetTouches[0].clientY));
                  
                  // 如果是橫向滑動，阻止默認行為
                  if (deltaX > deltaY && deltaX > 10) {
                    e.preventDefault();
                  }
                  setTouchEnd(touch.clientX);
                }
              }}
              onTouchEnd={(e) => {
                if (touchStart === null || touchEnd === null) {
                  setTouchStart(null);
                  setTouchEnd(null);
                  return;
                }
                const distance = touchStart - touchEnd;
                const minSwipeDistance = 30; // 降低觸發距離，讓滑動更靈敏
                const isLeftSwipe = distance > minSwipeDistance;
                const isRightSwipe = distance < -minSwipeDistance;
                
                if (isLeftSwipe && images.length > 1) {
                  setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }
                if (isRightSwipe && images.length > 1) {
                  setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }
                // 重置觸摸狀態
                setTouchStart(null);
                setTouchEnd(null);
              }}
            >
              <img
                src={images[selectedImageIndex]}
                alt={currentProduct.name}
                className={`w-full h-full select-none ${currentProduct.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                draggable={false}
              />
              {/* 左右箭頭 */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-white transition-all shadow-lg z-10"
                    aria-label="上一張"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-white transition-all shadow-lg z-10"
                    aria-label="下一張"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>
            
            {/* 商品規格 - 移到左側 */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800">商品規格</h2>
              </div>
              {currentProduct.specifications && Object.keys(currentProduct.specifications).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(currentProduct.specifications).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-gray-700 min-w-[80px]">{key}：</span>
                      <span className="text-gray-600">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-xs">暫無規格資訊</p>
              )}
            </div>
            
            {/* 縮圖列表 */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <button
                    onClick={() => setSelectedImageIndex(index)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-cute-primary scale-105'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${currentProduct.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 右側：商品資訊 */}
          <div className="space-y-6">
            {/* 分類和名稱 */}
            <div>
              <span className="text-cute-secondary text-sm font-bold uppercase tracking-wider">
                {translateCategory(currentProduct.category)}
              </span>
              <h1 className="text-4xl font-black text-gray-800 mt-2 mb-4">{currentProduct.name}</h1>
              
              {/* 評分 */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      fill={i < Math.floor(currentProduct.rating) ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                <span className="text-gray-600 font-bold">{currentProduct.rating.toFixed(1)}</span>
                <span className="text-gray-400 text-sm">({currentProduct.reviews?.length || 0} 評價)</span>
              </div>
            </div>

            {/* 價格 */}
            <div className="p-6 bg-pink-50 rounded-2xl border border-pink-100">
              <div className="text-4xl font-black text-cute-primary">${currentProduct.price.toFixed(2)}</div>
              <div className="flex items-center gap-4 mt-2">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  currentProduct.stock === 0 
                    ? 'bg-gray-100 text-gray-500' 
                    : currentProduct.stock < 5 
                    ? 'bg-red-100 text-red-500' 
                    : 'bg-green-100 text-green-500'
                }`}>
                  {currentProduct.stock === 0 ? '缺貨' : currentProduct.stock < 5 ? `僅剩 ${currentProduct.stock} 件!` : `庫存: ${currentProduct.stock} 件`}
                </span>
              </div>
            </div>

            {/* 商品描述 */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">商品描述</h2>
              <p className="text-gray-600 leading-relaxed">{currentProduct.description}</p>
            </div>

            {/* 數量選擇和加入購物車 */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <span className="font-bold text-gray-700">數量：</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 bg-pink-100 text-cute-primary rounded-full font-bold hover:bg-pink-200 transition-colors"
                    aria-label="減少數量"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={currentProduct.stock}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(currentProduct.stock, parseInt(e.target.value) || 1)))}
                    className="w-16 text-center border-2 border-cute-primary rounded-lg font-bold"
                    aria-label="商品數量"
                  />
                  <button
                    onClick={() => setQuantity(q => Math.min(currentProduct.stock, q + 1))}
                    className="w-10 h-10 bg-green-100 text-green-600 rounded-full font-bold hover:bg-green-200 transition-colors"
                    aria-label="增加數量"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={currentProduct.stock === 0 || quantity > currentProduct.stock}
                  className="flex-1 bg-cute-primary text-white font-bold py-4 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  <ShoppingCart size={24} />
                  加入購物車
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-100 text-gray-600 font-bold py-4 px-6 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>

            {/* 商品評價 */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MessageSquare size={24} />
                顧客評價 ({currentProduct.reviews?.length || 0})
              </h2>
              
              {/* 提交評價表單 */}
              {user && user.role !== 'admin' && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <div className="mb-3">
                    <span className="text-sm font-bold text-gray-700 mr-2">評分：</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setReviewRating(rating)}
                          className="text-yellow-400 hover:scale-110 transition-transform"
                          title={`評分 ${rating} 星`}
                          aria-label={`評分 ${rating} 星`}
                        >
                          <Star size={24} fill={rating <= reviewRating ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="分享您的購買體驗..."
                    className="w-full h-24 border border-gray-300 rounded-lg px-4 py-2 mb-3 resize-none"
                  />
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview || !reviewComment.trim()}
                    className="bg-cute-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingReview ? '提交中...' : '提交評價'}
                  </button>
                </div>
              )}

              {/* 評價列表 */}
              {currentProduct.reviews && currentProduct.reviews.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {currentProduct.reviews.map((review) => (
                    <div key={review.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800">{review.userName}</span>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              fill={i < review.rating ? 'currentColor' : 'none'}
                              className="text-yellow-400"
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">{review.comment}</p>
                      <p className="text-gray-400 text-xs mt-2">
                        {new Date(review.date).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">目前還沒有評價</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;