import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingCart, Star, Plus, X, Edit2, Save, Trash2, Upload, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, User, Review } from '../types';
import { updateProduct as updateProductFS } from '../firestoreHelpers';
import { compressImage } from '../utils/imageCompress';

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  user: User | null;
  onUpdateProduct: (product: Product) => Promise<void>;
  products: Product[];
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onClose, onAddToCart, user, onUpdateProduct, products }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product>(product);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 從 products 陣列中獲取最新的商品資料
  const currentProduct = products.find(p => p.id === product.id) || product;
  const images = currentProduct.images && currentProduct.images.length > 0 
    ? currentProduct.images 
    : [currentProduct.image];

  useEffect(() => {
    setEditedProduct(currentProduct);
  }, [currentProduct]);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;
    
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = '';
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案');
      e.target.value = '';
      return;
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      alert(`圖片檔案大小不能超過 ${Math.round(maxSize / 1024 / 1024)}MB`);
      e.target.value = '';
      return;
    }

    setIsProcessingImage(true);
    try {
      const compressedBase64 = await compressImage(file, 1200, 1200, 500 * 1024);
      const currentImages = editedProduct.images && editedProduct.images.length > 0 
        ? editedProduct.images 
        : [editedProduct.image];
      const newImages = [...currentImages, compressedBase64];
      setEditedProduct({ ...editedProduct, images: newImages });
      setSelectedImageIndex(newImages.length - 1); // 切換到新上傳的圖片
      console.log('Image uploaded successfully, total images:', newImages.length);
    } catch (error: any) {
      console.error('Image upload failed:', error);
      alert(`圖片處理失敗：${error.message || '請重試'}`);
    } finally {
      setIsProcessingImage(false);
      // 重置input，允許重複上傳同一文件
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    if (!isEditing) return;
    
    const currentImages = editedProduct.images && editedProduct.images.length > 0 
      ? editedProduct.images 
      : [editedProduct.image];
    
    const newImages = currentImages.filter((_, i) => i !== index);
    
    if (newImages.length === 0) {
      // 如果刪除所有圖片，保留原始圖片
      setEditedProduct({ ...editedProduct, images: [currentProduct.image] });
    } else {
      setEditedProduct({ ...editedProduct, images: newImages });
    }
    
    // 調整選中的圖片索引
    if (selectedImageIndex >= newImages.length) {
      setSelectedImageIndex(Math.max(0, newImages.length - 1));
    } else if (selectedImageIndex >= index && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const addSpecification = () => {
    if (newSpecKey && newSpecValue) {
      const newSpecs = { ...(editedProduct.specifications || {}), [newSpecKey]: newSpecValue };
      setEditedProduct({ ...editedProduct, specifications: newSpecs });
      setNewSpecKey('');
      setNewSpecValue('');
    }
  };

  const removeSpecification = (key: string) => {
    const newSpecs = { ...(editedProduct.specifications || {}) };
    delete newSpecs[key];
    setEditedProduct({ ...editedProduct, specifications: newSpecs });
  };

  const handleSave = async () => {
    try {
      // 確保 images 陣列正確保存
      const productToSave = {
        ...editedProduct,
        images: editedProduct.images && editedProduct.images.length > 0 
          ? editedProduct.images 
          : [editedProduct.image],
        // 確保所有欄位都正確
        name: editedProduct.name || currentProduct.name,
        price: Number(editedProduct.price) || currentProduct.price,
        description: editedProduct.description || currentProduct.description,
        category: editedProduct.category || currentProduct.category,
        stock: Number(editedProduct.stock) ?? currentProduct.stock,
        rating: Number(editedProduct.rating) || currentProduct.rating,
      };
      
      await onUpdateProduct(productToSave);
      setIsEditing(false);
      alert('商品已更新！');
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('更新失敗，請重試');
    }
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
      
      await onUpdateProduct(updatedProduct);
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

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen pt-28 px-4 pb-12 bg-cute-bg">
      <div className="max-w-7xl mx-auto">
        {/* 返回按鈕 */}
        <button
          onClick={onClose}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          返回商品列表
        </button>

        {/* Admin 編輯按鈕 */}
        {isAdmin && (
          <div className="mb-4 flex justify-end">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-cute-primary text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-400 transition-colors"
              >
                <Edit2 size={18} /> 編輯商品
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedProduct(currentProduct);
                  }}
                  className="bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="bg-green-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-600 transition-colors"
                >
                  <Save size={18} /> 儲存
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl p-6 md:p-12 shadow-lg">
          {/* 左側：商品圖片 */}
          <div className="space-y-4">
            {/* 主圖 */}
            <div 
              className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden group cursor-grab active:cursor-grabbing"
              onTouchStart={(e) => setTouchStart(e.targetTouches[0].clientX)}
              onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
              onTouchEnd={() => {
                if (touchStart === null || touchEnd === null) {
                  setTouchStart(null);
                  setTouchEnd(null);
                  return;
                }
                const distance = touchStart - touchEnd;
                const isLeftSwipe = distance > 50;
                const isRightSwipe = distance < -50;
                
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
                {isAdmin && isEditing && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="規格名稱"
                      value={newSpecKey}
                      onChange={(e) => setNewSpecKey(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-xs"
                      style={{ maxWidth: '80px' }}
                    />
                    <input
                      type="text"
                      placeholder="規格值"
                      value={newSpecValue}
                      onChange={(e) => setNewSpecValue(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-xs"
                      style={{ maxWidth: '100px' }}
                    />
                    <button
                      onClick={addSpecification}
                      className="bg-cute-primary text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-pink-400"
                    >
                      新增
                    </button>
                  </div>
                )}
              </div>
              {currentProduct.specifications && Object.keys(currentProduct.specifications).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(currentProduct.specifications).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-gray-700 min-w-[80px]">{key}：</span>
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                              const newSpecs = { ...(currentProduct.specifications || {}) };
                              newSpecs[key] = e.target.value;
                              setEditedProduct({ ...editedProduct, specifications: newSpecs });
                            }}
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => removeSpecification(key)}
                            className="text-red-500 hover:text-red-700"
                            aria-label="刪除規格"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-600">{value}</span>
                      )}
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
                  {isAdmin && isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(index);
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-20"
                      aria-label="刪除圖片"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {isAdmin && isEditing && (
                <label className="flex-shrink-0 w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-cute-primary hover:bg-pink-50 transition-all active:scale-95 group">
                  {isProcessingImage ? (
                    <div className="w-6 h-6 border-2 border-cute-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Plus size={24} className="text-gray-400 group-hover:text-cute-primary" />
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    onClick={(e) => {
                      // 確保在手機上也能觸發
                      e.stopPropagation();
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 右側：商品資訊 */}
          <div className="space-y-6">
            {/* 分類和名稱 */}
            <div>
              <span className="text-cute-secondary text-sm font-bold uppercase tracking-wider">
                {translateCategory(currentProduct.category)}
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProduct.name}
                  onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                  className="w-full text-4xl font-black text-gray-800 mt-2 mb-4 border-2 border-cute-primary rounded-xl px-4 py-2"
                />
              ) : (
                <h1 className="text-4xl font-black text-gray-800 mt-2 mb-4">{currentProduct.name}</h1>
              )}
              
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
              {isEditing ? (
                <input
                  type="number"
                  value={editedProduct.price}
                  onChange={(e) => setEditedProduct({ ...editedProduct, price: parseFloat(e.target.value) || 0 })}
                  className="text-4xl font-black text-cute-primary w-full border-2 border-cute-primary rounded-xl px-4 py-2"
                />
              ) : (
                <div className="text-4xl font-black text-cute-primary">${currentProduct.price.toFixed(2)}</div>
              )}
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
              {isEditing ? (
                <textarea
                  value={editedProduct.description}
                  onChange={(e) => setEditedProduct({ ...editedProduct, description: e.target.value })}
                  className="w-full h-32 border-2 border-cute-primary rounded-xl px-4 py-2"
                />
              ) : (
                <p className="text-gray-600 leading-relaxed">{currentProduct.description}</p>
              )}
            </div>


            {/* 數量選擇和加入購物車 */}
            {!isEditing && (
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
            )}

            {/* 商品評價 */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MessageSquare size={24} />
                顧客評價 ({currentProduct.reviews?.length || 0})
              </h2>
              
              {/* 提交評價表單 */}
              {user && !isAdmin && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <div className="mb-3">
                    <span className="text-sm font-bold text-gray-700 mr-2">評分：</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setReviewRating(rating)}
                          className="text-yellow-400 hover:scale-110 transition-transform"
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