import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Package, Users, DollarSign, TrendingUp, Plus, Edit2, X, Save, Upload, Sparkles, Trash2, RotateCcw, ScrollText, CheckCircle2, Smile, ChevronDown, ChevronUp, Truck, LayoutDashboard } from 'lucide-react';
import { Product, Order, User } from '../types';
import { compressImage } from '../utils/imageCompress';
import { getMarqueeMessages, updateMarqueeMessages, getUserProfile, getAllUserProfiles } from '../firestoreHelpers';

interface AdminPanelProps {
  products: Product[];
  orders: Order[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct?: (id: string) => void;
  onUpdateOrderStatus?: (orderId: string, status: 'pending' | 'shipped' | 'completed' | 'cancelled') => Promise<void>;
  wishes?: string[] | Array<{ id: string; text?: string; [key: string]: any }>;
  onDeleteWish?: (wishId: string) => Promise<void>;
  onResetData?: () => Promise<void>;
  onCategoriesChange?: (categories: string[]) => void; // 通知父組件類別變更
  currentUser?: User | null;
  customCategories: string[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ products, orders, onUpdateProduct, onAddProduct, onDeleteProduct, onUpdateOrderStatus, wishes = [], onDeleteWish, onResetData, onCategoriesChange, currentUser, customCategories }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'wishes' | 'marquee' | 'stats' | 'users'>('orders');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [isEditingMarquee, setIsEditingMarquee] = useState(false);
  const [marqueeMessages, setMarqueeMessages] = useState<string[]>([]);
  const [marqueeSpeed, setMarqueeSpeed] = useState<number>(30);
  const [isLoadingMarquee, setIsLoadingMarquee] = useState(true);
  const [isSavingMarquee, setIsSavingMarquee] = useState(false);
  const [isPendingOrdersCollapsed, setIsPendingOrdersCollapsed] = useState(false);
  const [isShippedOrdersCollapsed, setIsShippedOrdersCollapsed] = useState(false);
  const [isCompletedOrdersCollapsed, setIsCompletedOrdersCollapsed] = useState(false);
  const [isCancelledOrdersCollapsed, setIsCancelledOrdersCollapsed] = useState(false);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  
  // 表情符號列表
  const emojis = ['🎉', '✨', '🚀', '💝', '🎁', '🔥', '⭐', '💎', '🎊', '🎈', '🎀', '💖', '❤️', '💕', '💗', '💓', '💞', '💯', '✅', '👍', '👏', '🎯', '🏆', '🎪', '🎭', '🛍️', '💰', '💳', '🎫', '🎟️'];
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  // 新增 state 與 fx：監聽所有 userProfile、整理用戶資料
  const [userList, setUserList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  // 新增類別 modal 狀態
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Debug: 確保wishes更新時重新渲染
  React.useEffect(() => {
    console.log('AdminPanel wishes updated:', wishes);
  }, [wishes]);

  // Derived Statistics from REAL orders (passed via props)
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const shippedOrdersCount = orders.filter(o => o.status === 'shipped').length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const cancelledOrdersCount = orders.filter(o => o.status === 'cancelled').length;
  const totalOrdersCount = orders.length;
  // Mock total users for now as we don't have a full DB, but could track unique userIds from orders
  const uniqueCustomers = new Set(orders.map(o => o.userId)).size; 

  // Prepare chart data based on orders
  // Group orders by day (simple implementation)
  const salesByDay = orders.reduce((acc, order) => {
    const day = new Date(order.date).toLocaleDateString('zh-TW', { weekday: 'short' });
    const existing = acc.find(d => d.name === day);
    if (existing) {
      existing.sales += order.total;
    } else {
      acc.push({ name: day, sales: order.total });
    }
    return acc;
  }, [] as { name: string; sales: number }[]);
  
  // If no sales, show empty chart placeholders or last 7 days empty
  const chartData = salesByDay.length > 0 ? salesByDay : [
    { name: '一', sales: 0 },
    { name: '二', sales: 0 },
    { name: '三', sales: 0 },
    { name: '四', sales: 0 },
    { name: '五', sales: 0 },
    { name: '六', sales: 0 },
    { name: '日', sales: 0 },
  ];

  const categoryData = [
    { name: '科幻', count: products.filter(p => p.category === 'Sci-Fi').length },
    { name: '奇幻', count: products.filter(p => p.category === 'Fantasy').length },
    { name: '動漫', count: products.filter(p => p.category === 'Anime').length },
    { name: '客製化', count: products.filter(p => p.category === 'Custom').length },
  ];

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      // 使用編輯後的圖片陣列，如果沒有則使用原始圖片
      const editedImages = (editingProduct as any)._editedImages;
      // 如果 _editedImages 明確設置為空數組，允許完全刪除
      const images = editedImages !== undefined 
        ? editedImages 
        : (editingProduct.images && editingProduct.images.length > 0 ? editingProduct.images : [editingProduct.image]);
      
      // 如果編輯後的圖片陣列存在且不為空，使用第一張圖片作為新的主圖
      // 如果所有圖片都被刪除，使用預設圖片
      const newMainImage = (images.length > 0) 
        ? images[0] 
        : 'https://via.placeholder.com/400';
      
      const updatedProduct: any = {
        ...editingProduct,
        image: newMainImage // 使用新圖片作為主圖
      };
      
      // 處理 images 欄位：如果有多張圖片則設置，否則移除該欄位
      if (images.length > 1) {
        updatedProduct.images = images;
      } else {
        // 如果只有一張或沒有圖片，移除 images 欄位（使用主圖即可）
        delete updatedProduct.images;
      }
      
      // 移除臨時欄位
      delete updatedProduct._newImageFile;
      delete updatedProduct._newImagePreview;
      delete updatedProduct._editedImages;
      
      try {
        await onUpdateProduct(updatedProduct);
      setEditingProduct(null);
        console.log('Product updated successfully:', updatedProduct.name);
      } catch (error: any) {
        console.error('Failed to update product:', error);
        alert(`更新商品失敗：${error.message || '請重試'}`);
      }
    }
  };

  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    isNewProduct: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    // 驗證檔案類型
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案（JPG、PNG、GIF 等）');
      e.target.value = '';
      return;
    }
    
    // 限制原始檔案大小（20MB，手機照片可能較大，但會壓縮）
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      alert(`圖片檔案大小不能超過 ${Math.round(maxSize / 1024 / 1024)}MB\n目前檔案：${(file.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = '';
      return;
    }
    
    // 檢查檔案是否為空
    if (file.size === 0) {
      alert('檔案為空，請選擇有效的圖片檔案');
      e.target.value = '';
      return;
    }
    
    // 顯示壓縮中狀態
    setIsUploadingImage(true);
    
    try {
      // 壓縮圖片
      console.log('Compressing image...');
      const compressedBase64 = await compressImage(file);
      console.log('Image compressed successfully');
      
      if (isNewProduct) {
        // 新增商品：支援多張圖片，但限制總數量和大小
        setNewProductImages(prev => {
          // 限制最多5張圖片，避免超過Firestore 1MB限制
          if (prev.length >= 5) {
            alert('最多只能上傳5張圖片！');
            setIsUploadingImage(false);
            e.target.value = '';
            return prev;
          }
          
          // 檢查總大小（估算）
          const estimatedTotalSize = (prev.length + 1) * 150 * 1024; // 每張約150KB
          if (estimatedTotalSize > 900 * 1024) { // 預留100KB給其他資料
            alert('圖片總大小過大，請減少圖片數量或使用更小的圖片！');
            setIsUploadingImage(false);
            e.target.value = '';
            return prev;
          }
          
          const updatedImages = [...prev, compressedBase64];
          if (prev.length === 0) {
            // 第一張圖片作為主圖預覽
            setNewProductImageFile(file);
            setNewProductImagePreview(compressedBase64);
            setNewProduct(prevProduct => prevProduct ? { ...prevProduct, image: compressedBase64 } : null);
          } else {
            // 更新主圖為第一張
            setNewProduct(prevProduct => prevProduct ? { ...prevProduct, image: updatedImages[0] } : null);
          }
          console.log('Image added to new product, total:', updatedImages.length);
          return updatedImages;
        });
      } else if (editingProduct) {
        setEditingProduct({ 
          ...editingProduct, 
          image: compressedBase64, 
          _newImageFile: file, 
          _newImagePreview: compressedBase64 
        });
        console.log('Preview set for editing product');
      }
    } catch (error: any) {
      console.error('Image compression failed:', error);
      alert(`圖片處理失敗：${error.message || '請重試'}`);
    } finally {
      setIsUploadingImage(false);
      // 重置 input 值，允許重新選擇同一檔案
      e.target.value = '';
    }
  };

  const [newProduct, setNewProduct] = useState<Partial<Product> | null>(null);
  const [newProductImageFile, setNewProductImageFile] = useState<File|null>(null);
  const [newProductImagePreview, setNewProductImagePreview] = useState<string>('');
  const [newProductImages, setNewProductImages] = useState<string[]>([]); // 支援多張圖片

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newProduct && newProduct.name && newProduct.price !== undefined && newProduct.stock !== undefined) {
      let imageUrl = newProduct.image || 'https://via.placeholder.com/400';
      
      // 如果有新圖片，直接使用已壓縮的 base64（已在 handleImageChange 中處理）
      if (newProductImagePreview) {
        imageUrl = newProductImagePreview;
      }
      
      // 處理多張圖片
      const imagesArray = newProductImages.length > 0 ? newProductImages : (newProductImagePreview ? [newProductImagePreview] : (imageUrl ? [imageUrl] : []));
      
      const productToAdd: any = {
        id: `product-${Date.now()}`,
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        description: (newProduct.description || '').trim(),
        category: (newProduct.category || customCategories[0] || 'Custom'),
        image: imagesArray.length > 0 ? imagesArray[0] : imageUrl,
        stock: Number(newProduct.stock),
        rating: 5.0,
        isNew: true,
        imageFit: newProduct.imageFit || 'contain' // 預設完整顯示
      };
      
      // 如果有多張圖片，設置 images 欄位
      if (imagesArray.length > 1) {
        productToAdd.images = imagesArray;
      }
      
      try {
        console.log('Adding product to Firestore:', productToAdd);
        await onAddProduct(productToAdd);
        setNewProduct(null);
        setNewProductImageFile(null);
        setNewProductImagePreview('');
        setNewProductImages([]);
        setIsAddingProduct(false);
        console.log('Product added successfully');
      } catch (error: any) {
        console.error('Failed to add product:', error);
        alert(`新增商品失敗：${error.message || '請重試'}`);
      }
    }
  };

  // 當開啟新增商品modal時，初始化newProduct
  React.useEffect(() => {
    if (isAddingProduct && !newProduct) {
      setNewProduct({
        name: '',
        price: 0,
        description: '',
        category: 'Custom',
        image: 'https://via.placeholder.com/400',
        stock: 0,
        imageFit: 'contain' // 預設完整顯示
      });
      setNewProductImages([]);
    }
  }, [isAddingProduct]);

  // 載入跑馬燈內容
  React.useEffect(() => {
    loadMarqueeMessages();
  }, []);

  const loadMarqueeMessages = async () => {
    setIsLoadingMarquee(true);
    try {
      const { messages, speed } = await getMarqueeMessages();
      setMarqueeMessages(messages);
      setMarqueeSpeed(speed);
    } catch (error) {
      console.error('Failed to load marquee messages:', error);
    } finally {
      setIsLoadingMarquee(false);
    }
  };

  const handleSaveMarquee = async () => {
    setIsSavingMarquee(true);
    try {
      await updateMarqueeMessages(marqueeMessages, marqueeSpeed);
      setIsEditingMarquee(false);
      alert('跑馬燈內容已更新！');
    } catch (error) {
      console.error('Failed to save marquee messages:', error);
      alert('儲存失敗，請重試');
    } finally {
      setIsSavingMarquee(false);
    }
  };

  const addMarqueeMessage = () => {
    setMarqueeMessages([...marqueeMessages, '']);
  };

  const removeMarqueeMessage = (index: number) => {
    setMarqueeMessages(marqueeMessages.filter((_, i) => i !== index));
  };

  const updateMarqueeMessage = (index: number, value: string) => {
    const newMessages = [...marqueeMessages];
    newMessages[index] = value;
    setMarqueeMessages(newMessages);
  };

  const insertEmoji = (index: number, emoji: string) => {
    const newMessages = [...marqueeMessages];
    newMessages[index] = (newMessages[index] || '') + emoji;
    setMarqueeMessages(newMessages);
  };

  useEffect(() => {
    async function fetchAllUsers() {
      setIsLoadingUsers(true);
      try {
        const users = await getAllUserProfiles();
        // 為每個用戶補充 email 和登入時間資訊
        const enrichedUsers = users.map(user => {
          // 從訂單中找出該用戶的資訊
          const userOrders = orders.filter(o => o.userId === user.userId);
          const latestOrder = userOrders.length > 0 
            ? userOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            : null;
          
          // Email：從 userProfiles 中的 email 欄位取得
          const email = user.email || '-';
          
          // 登入時間：優先使用 lastLoginTime，如果沒有則使用 updatedAt
          let lastLoginTime = null;
          if (user.lastLoginTime) {
            lastLoginTime = typeof user.lastLoginTime === 'string' ? new Date(user.lastLoginTime) : user.lastLoginTime;
          } else if (user.updatedAt) {
            lastLoginTime = typeof user.updatedAt === 'string' ? new Date(user.updatedAt) : user.updatedAt;
          }
          
          return {
            ...user,
            email,
            lastLoginTime,
            orders: userOrders, // 保存該用戶的所有訂單以便展開顯示
          };
        });
        setUserList(enrichedUsers);
      } catch (e) {
        console.error('Failed to fetch users:', e);
        setUserList([]);
      }
      setIsLoadingUsers(false);
    }
    if (activeTab === 'users') fetchAllUsers();
  }, [activeTab, orders]);

  const handleAddCategory = (newCategory: string) => {
    if (!customCategories.includes(newCategory)) {
      const updated = [...customCategories, newCategory];
      onCategoriesChange?.(updated);
    }
  };

  const handleDeleteCategory = (cat: string) => {
    const updated = customCategories.filter(c => c !== cat);
    onCategoriesChange?.(updated);
  };

  return (
    <div className="min-h-screen pt-28 px-4 pb-12 bg-cute-bg">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-800 mb-2">賣家儀表板</h1>
            <p className="text-gray-500">歡迎回來，老闆！ 🍪</p>
          </div>

        {/* 標籤頁導航 */}
        <div className="bg-white rounded-3xl border border-pink-50 shadow-sm mb-6 overflow-x-auto">
          <div className="flex space-x-1 p-2">
            {[
              { id: 'orders' as const, label: '訂單管理', icon: Package, count: orders.length },
              { id: 'products' as const, label: '商品管理', icon: Edit2, count: products.length },
              { id: 'wishes' as const, label: '許願池', icon: Sparkles, count: wishes.length },
              { id: 'marquee' as const, label: '跑馬燈', icon: ScrollText },
              { id: 'stats' as const, label: '數據統計', icon: BarChart },
              { id: 'users' as const, label: '會員管理', icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cute-primary text-white shadow-lg'
                    : 'text-gray-600 hover:bg-pink-50 hover:text-cute-primary'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 標籤頁內容 */}
        {activeTab === 'orders' && (
          <>
            {/* 待處理訂單列表 */}
            <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-lg overflow-hidden mb-8">
              <button
                onClick={() => setIsPendingOrdersCollapsed(!isPendingOrdersCollapsed)}
                className="w-full p-6 border-b-2 border-blue-200 bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    待處理訂單
                    <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-bold">
                      {orders.filter(o => o.status === 'pending').length}
                    </span>
                  </h3>
                  {isPendingOrdersCollapsed ? (
                    <ChevronDown className="w-5 h-5 text-blue-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
              {!isPendingOrdersCollapsed && (
                <div className="p-6">
                  {orders.filter(o => o.status === 'pending').length > 0 ? (
                    <div className="space-y-4">
                      {orders.filter(o => o.status === 'pending').map((order: any) => (
                        <div key={order.id} className="p-6 bg-gradient-to-br from-blue-50 to-white rounded-2xl border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex justify-between items-start mb-5 pb-4 border-b-2 border-blue-200">
                            <div>
                              <div className="font-black text-gray-900 text-xl mb-2">訂單 #{order.id?.slice(-8) || 'N/A'}</div>
                              <div className="text-sm text-gray-600 font-medium">
                                📅 {order.date ? new Date(order.date.seconds ? order.date.seconds * 1000 : order.date).toLocaleString('zh-TW') : '日期未知'}
                              </div>
                            </div>
                            <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-xl text-sm font-black shadow-sm">待處理</span>
                          </div>
                          
                          {/* 商品列表 */}
                          <div className="mb-5">
                            <div className="font-black text-gray-800 mb-3 text-lg flex items-center gap-2">
                              <Package size={18} className="text-blue-600" />
                              商品內容
                            </div>
                            <div className="space-y-3">
                              {order.items?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border-2 border-blue-100" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-gray-900 mb-1 truncate">{item.name}</div>
                                    <div className="text-sm text-gray-600 font-medium">數量: {item.quantity} × ${item.price?.toFixed(2) || '0.00'}</div>
                                  </div>
                                  <div className="font-black text-cute-primary text-lg">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 收貨資訊 */}
                          {order.shippingInfo && (
                            <div className="mb-5 p-4 bg-blue-50/80 rounded-xl border-2 border-blue-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">📦 收貨資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">收貨人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.name}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">電話</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.phone}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">地址</span>
                                  <span className="text-gray-900 font-semibold text-base block">{order.shippingInfo.country} {order.shippingInfo.city} {order.shippingInfo.postalCode}</span>
                                  <div className="text-gray-900 font-semibold text-base mt-1">{order.shippingInfo.address}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 付款資訊 */}
                          {order.paymentInfo && (
                            <div className="mb-5 p-4 bg-green-50/80 rounded-xl border-2 border-green-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">💳 付款資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">持卡人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.paymentInfo.cardholderName}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">卡號</span>
                                  <span className="text-gray-900 font-semibold text-base font-mono">**** **** **** {order.paymentInfo.cardNumber?.slice(-4) || '****'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 總金額 */}
                          <div className="flex justify-between items-center pt-4 border-t-2 border-blue-200 mb-4 bg-white/50 p-4 rounded-xl">
                            <span className="text-gray-700 font-black text-lg">總金額</span>
                            <span className="text-3xl font-black text-cute-primary">${order.total?.toFixed(2) || '0.00'}</span>
                          </div>

                          {/* 操作按鈕 */}
                          {onUpdateOrderStatus && (
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={async () => {
                                  if (window.confirm('確定要將此訂單標記為「已出貨」嗎？')) {
                                    setShippingOrderId(order.id);
                                    try {
                                      await onUpdateOrderStatus(order.id, 'shipped');
                                      setShippingOrderId(null);
                                    } catch (error) {
                                      console.error('Failed to update order status:', error);
                                      alert('更新訂單狀態失敗，請重試');
                                      setShippingOrderId(null);
                                    }
                                  }
                                }}
                                disabled={shippingOrderId === order.id || completingOrderId === order.id}
                                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                              >
                                {shippingOrderId === order.id ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    處理中...
                                  </>
                                ) : (
                                  <>
                                    <Truck size={18} /> 標記為已出貨
                                  </>
                                )}
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm('確定要將此訂單標記為「已完成」嗎？')) {
                                    setCompletingOrderId(order.id);
                                    try {
                                      await onUpdateOrderStatus(order.id, 'completed');
                                      setCompletingOrderId(null);
                                    } catch (error) {
                                      console.error('Failed to update order status:', error);
                                      alert('更新訂單狀態失敗，請重試');
                                      setCompletingOrderId(null);
                                    }
                                  }
                                }}
                                disabled={shippingOrderId === order.id || completingOrderId === order.id}
                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                              >
                                {completingOrderId === order.id ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    處理中...
                                  </>
                                ) : (
                                  <>
                                    <span>✓</span> 標記為已完成
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">目前沒有待處理的訂單</p>
                  )}
                </div>
              )}
            </div>

            {/* 已出貨訂單列表 */}
            <div className="bg-white rounded-3xl border-2 border-purple-200 shadow-lg overflow-hidden mb-8">
              <button
                onClick={() => setIsShippedOrdersCollapsed(!isShippedOrdersCollapsed)}
                className="w-full p-6 border-b-2 border-purple-200 bg-gradient-to-r from-purple-100 to-purple-50 hover:from-purple-200 hover:to-purple-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-purple-700 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-purple-600" />
                    已出貨訂單
                    <span className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-bold">
                      {orders.filter(o => o.status === 'shipped').length}
                    </span>
                  </h3>
                  {isShippedOrdersCollapsed ? (
                    <ChevronDown className="w-5 h-5 text-purple-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-purple-600" />
                  )}
                </div>
              </button>
              {!isShippedOrdersCollapsed && (
                <div className="p-6">
                  {orders.filter(o => o.status === 'shipped').length > 0 ? (
                    <div className="space-y-4">
                      {orders.filter(o => o.status === 'shipped').map((order: any) => (
                        <div key={order.id} className="p-6 bg-gradient-to-br from-purple-50 to-white rounded-2xl border-2 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex justify-between items-start mb-5 pb-4 border-b-2 border-purple-200">
                            <div>
                              <div className="font-black text-gray-900 text-xl mb-2">訂單 #{order.id?.slice(-8) || 'N/A'}</div>
                              <div className="text-sm text-gray-600 font-medium">
                                📅 {order.date ? new Date(order.date.seconds ? order.date.seconds * 1000 : order.date).toLocaleString('zh-TW') : '日期未知'}
                              </div>
                            </div>
                            <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-xl text-sm font-black shadow-sm">已出貨</span>
                          </div>
                          
                          {/* 商品列表 */}
                          <div className="mb-5">
                            <div className="font-black text-gray-800 mb-3 text-lg flex items-center gap-2">
                              <Package size={18} className="text-purple-600" />
                              商品內容
                            </div>
                            <div className="space-y-3">
                              {order.items?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border-2 border-purple-100" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-gray-900 mb-1 truncate">{item.name}</div>
                                    <div className="text-sm text-gray-600 font-medium">數量: {item.quantity} × ${item.price?.toFixed(2) || '0.00'}</div>
                                  </div>
                                  <div className="font-black text-cute-primary text-lg">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 收貨資訊 */}
                          {order.shippingInfo && (
                            <div className="mb-5 p-4 bg-purple-50/80 rounded-xl border-2 border-purple-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">📦 收貨資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">收貨人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.name}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">電話</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.phone}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">地址</span>
                                  <span className="text-gray-900 font-semibold text-base block">{order.shippingInfo.country} {order.shippingInfo.city} {order.shippingInfo.postalCode}</span>
                                  <div className="text-gray-900 font-semibold text-base mt-1">{order.shippingInfo.address}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 付款資訊 */}
                          {order.paymentInfo && (
                            <div className="mb-5 p-4 bg-green-50/80 rounded-xl border-2 border-green-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">💳 付款資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">持卡人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.paymentInfo.cardholderName}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">卡號</span>
                                  <span className="text-gray-900 font-semibold text-base font-mono">**** **** **** {order.paymentInfo.cardNumber?.slice(-4) || '****'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 總金額和操作 */}
                          <div className="pt-4 border-t-2 border-purple-200 mb-4">
                            <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl mb-4">
                              <span className="text-gray-700 font-black text-lg">總金額</span>
                              <span className="text-3xl font-black text-cute-primary">${order.total?.toFixed(2) || '0.00'}</span>
                            </div>
                            {onUpdateOrderStatus && (
                              <div className="flex justify-end">
                                <button
                                  onClick={async () => {
                                    if (window.confirm('確定要將此訂單標記為「已完成」嗎？')) {
                                      setCompletingOrderId(order.id);
                                      try {
                                        await onUpdateOrderStatus(order.id, 'completed');
                                        setCompletingOrderId(null);
                                      } catch (error) {
                                        console.error('Failed to update order status:', error);
                                        alert('更新訂單狀態失敗，請重試');
                                        setCompletingOrderId(null);
                                      }
                                    }
                                  }}
                                  disabled={completingOrderId === order.id}
                                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                >
                                  {completingOrderId === order.id ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      處理中...
                                    </>
                                  ) : (
                                    <>
                                      <span>✓</span> 標記為已完成
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">目前沒有已出貨的訂單</p>
                  )}
                </div>
              )}
            </div>

            {/* 已完成訂單列表 */}
            <div className="bg-white rounded-3xl border-2 border-green-200 shadow-lg overflow-hidden mb-8">
              <button
                onClick={() => setIsCompletedOrdersCollapsed(!isCompletedOrdersCollapsed)}
                className="w-full p-6 border-b-2 border-green-200 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    已完成訂單
                    <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold">
                      {orders.filter(o => o.status === 'completed').length}
                    </span>
                  </h3>
                  {isCompletedOrdersCollapsed ? (
                    <ChevronDown className="w-5 h-5 text-green-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </button>
              {!isCompletedOrdersCollapsed && (
                <div className="p-6">
                  {orders.filter(o => o.status === 'completed').length > 0 ? (
                    <div className="space-y-4">
                      {orders.filter(o => o.status === 'completed').map((order: any) => (
                        <div key={order.id} className="p-6 bg-gradient-to-br from-green-50 to-white rounded-2xl border-2 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex justify-between items-start mb-5 pb-4 border-b-2 border-green-200">
                            <div>
                              <div className="font-black text-gray-900 text-xl mb-2">訂單 #{order.id?.slice(-8) || 'N/A'}</div>
                              <div className="text-sm text-gray-600 font-medium">
                                📅 {order.date ? new Date(order.date.seconds ? order.date.seconds * 1000 : order.date).toLocaleString('zh-TW') : '日期未知'}
                              </div>
                            </div>
                            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-xl text-sm font-black shadow-sm">已完成</span>
                          </div>
                          
                          {/* 商品列表 */}
                          <div className="mb-5">
                            <div className="font-black text-gray-800 mb-3 text-lg flex items-center gap-2">
                              <Package size={18} className="text-green-600" />
                              商品內容
                            </div>
                            <div className="space-y-3">
                              {order.items?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-green-100 shadow-sm hover:shadow-md transition-shadow">
                                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border-2 border-green-100" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-gray-900 mb-1 truncate">{item.name}</div>
                                    <div className="text-sm text-gray-600 font-medium">數量: {item.quantity} × ${item.price?.toFixed(2) || '0.00'}</div>
                                  </div>
                                  <div className="font-black text-cute-primary text-lg">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 收貨資訊 */}
                          {order.shippingInfo && (
                            <div className="mb-5 p-4 bg-green-50/80 rounded-xl border-2 border-green-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">📦 收貨資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">收貨人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.name}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">電話</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.phone}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">地址</span>
                                  <span className="text-gray-900 font-semibold text-base block">{order.shippingInfo.country} {order.shippingInfo.city} {order.shippingInfo.postalCode}</span>
                                  <div className="text-gray-900 font-semibold text-base mt-1">{order.shippingInfo.address}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 付款資訊 */}
                          {order.paymentInfo && (
                            <div className="mb-5 p-4 bg-green-50/80 rounded-xl border-2 border-green-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">💳 付款資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">持卡人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.paymentInfo.cardholderName}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">卡號</span>
                                  <span className="text-gray-900 font-semibold text-base font-mono">**** **** **** {order.paymentInfo.cardNumber?.slice(-4) || '****'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 總金額 */}
                          <div className="flex justify-between items-center pt-4 border-t-2 border-green-200 bg-white/50 p-4 rounded-xl">
                            <span className="text-gray-700 font-black text-lg">總金額</span>
                            <span className="text-3xl font-black text-cute-primary">${order.total?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">目前沒有已完成的訂單</p>
                  )}
                </div>
              )}
            </div>

            {/* 已取消訂單列表 */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-lg overflow-hidden mb-8">
              <button
                onClick={() => setIsCancelledOrdersCollapsed(!isCancelledOrdersCollapsed)}
                className="w-full p-6 border-b-2 border-gray-200 bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                    <X className="w-5 h-5 text-gray-600" />
                    已取消訂單
                    <span className="px-3 py-1 bg-gray-500 text-white rounded-full text-sm font-bold">
                      {orders.filter(o => o.status === 'cancelled').length}
                    </span>
                  </h3>
                  {isCancelledOrdersCollapsed ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  )}
                </div>
              </button>
              {!isCancelledOrdersCollapsed && (
                <div className="p-6">
                  {orders.filter(o => o.status === 'cancelled').length > 0 ? (
                    <div className="space-y-4">
                      {orders.filter(o => o.status === 'cancelled').map((order: any) => (
                        <div key={order.id} className="p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex justify-between items-start mb-5 pb-4 border-b-2 border-gray-200">
                            <div>
                              <div className="font-black text-gray-900 text-xl mb-2">訂單 #{order.id?.slice(-8) || 'N/A'}</div>
                              <div className="text-sm text-gray-600 font-medium">
                                📅 {order.date ? new Date(order.date.seconds ? order.date.seconds * 1000 : order.date).toLocaleString('zh-TW') : '日期未知'}
                              </div>
                            </div>
                            <span className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-sm font-black shadow-sm">已取消</span>
                          </div>
                          
                          {/* 商品列表 */}
                          <div className="mb-5">
                            <div className="font-black text-gray-800 mb-3 text-lg flex items-center gap-2">
                              <Package size={18} className="text-gray-600" />
                              商品內容
                            </div>
                            <div className="space-y-3">
                              {order.items?.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border-2 border-gray-100" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-gray-900 mb-1 truncate">{item.name}</div>
                                    <div className="text-sm text-gray-600 font-medium">數量: {item.quantity} × ${item.price?.toFixed(2) || '0.00'}</div>
                                  </div>
                                  <div className="font-black text-cute-primary text-lg">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 收貨資訊 */}
                          {order.shippingInfo && (
                            <div className="mb-5 p-4 bg-gray-50/80 rounded-xl border-2 border-gray-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">📦 收貨資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">收貨人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.name}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">電話</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.shippingInfo.phone}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">地址</span>
                                  <span className="text-gray-900 font-semibold text-base block">{order.shippingInfo.country} {order.shippingInfo.city} {order.shippingInfo.postalCode}</span>
                                  <div className="text-gray-900 font-semibold text-base mt-1">{order.shippingInfo.address}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 付款資訊 */}
                          {order.paymentInfo && (
                            <div className="mb-5 p-4 bg-gray-50/80 rounded-xl border-2 border-gray-100">
                              <div className="font-black text-gray-800 mb-3 text-lg">💳 付款資訊</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">持卡人</span>
                                  <span className="text-gray-900 font-semibold text-base">{order.paymentInfo.cardholderName}</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide block mb-2">卡號</span>
                                  <span className="text-gray-900 font-semibold text-base font-mono">**** **** **** {order.paymentInfo.cardNumber?.slice(-4) || '****'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 總金額 */}
                          <div className="flex justify-between items-center pt-4 border-t-2 border-gray-200 bg-white/50 p-4 rounded-xl">
                            <span className="text-gray-700 font-black text-lg">總金額</span>
                            <span className="text-3xl font-black text-cute-primary">${order.total?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">目前沒有已取消的訂單</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'wishes' && (
          <>
            {/* 買家許願池 */}
            <div className="bg-white rounded-3xl border border-pink-50 shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-pink-50 bg-gradient-to-r from-pink-50 to-white">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cute-primary" />
                  買家許願池（即時同步）
                </h3>
              </div>
              <div className="p-6">
                {wishes && wishes.length > 0 ? (
                  <ul className="space-y-3">
                    {wishes.map((w, i) => {
                      const wishId = typeof w === 'object' && w.id ? w.id : `wish-${i}`;
                      const wishText = typeof w === 'string' ? w : (w.text || w);
                      return (
                        <li key={wishId} className="p-4 bg-pink-50 rounded-xl border border-pink-100 hover:bg-pink-100 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="text-cute-primary font-bold text-lg flex-shrink-0">#{i + 1}</span>
                            <p className="text-gray-700 font-medium break-words flex-1">{wishText}</p>
                            {onDeleteWish && (
                              <button
                                onClick={async () => {
                                  if (window.confirm('確定要刪除此許願嗎？')) {
                                    try {
                                      await onDeleteWish(wishId);
                                    } catch (error) {
                                      console.error('Failed to delete wish:', error);
                                      alert('刪除失敗，請重試');
                                    }
                                  }
                                }}
                                className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                                aria-label="刪除許願"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-center py-8">目前還沒有買家許願，期待第一個願望！✨</p>
                )}
              </div>
            </div>
          </>
        )}


        {activeTab === 'products' && (
          <>
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-black text-gray-800">商品管理</h2>
              <div className="flex gap-3 flex-wrap">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddCategoryModal(true);
                    setNewCategoryName('');
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors shadow-sm"
                >
                  <Plus size={16} /> 新增類別
                </button>
                {customCategories.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-600">類別列表：</span>
                    {customCategories.map((cat) => (
                      <div key={cat} className="flex items-center gap-1 bg-pink-50 px-3 py-1 rounded-lg border border-pink-200">
                        <span className="text-sm font-medium text-gray-700">{cat}</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // 檢查是否有商品使用此類別
                            const productsUsingCategory = products.filter(p => p.category === cat);
                            if (productsUsingCategory.length > 0) {
                              if (!window.confirm(`類別「${cat}」目前有 ${productsUsingCategory.length} 個商品使用中，確定要刪除嗎？刪除後這些商品的類別將需要重新設定。`)) {
                                return;
                              }
                            } else {
                              if (!window.confirm(`確定要刪除類別「${cat}」嗎？`)) {
                                return;
                              }
                            }
                            handleDeleteCategory(cat);
                            alert(`類別「${cat}」已刪除！`);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors"
                          aria-label={`刪除類別 ${cat}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAddingProduct(true);
                  }}
                  className="bg-cute-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-400 transition-colors shadow-lg active:scale-95"
                >
                  <Plus size={18} /> 新增商品
                </button>
              </div>
            </div>

            {/* Product List Table */}
            <div className="bg-white rounded-3xl border border-pink-50 shadow-sm overflow-hidden mb-8">
              <div className="p-4 sm:p-8 border-b border-pink-50">
                <h3 className="text-xl font-bold text-gray-800">商品列表</h3>
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-pink-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 lg:px-8 py-5">商品</th>
                      <th className="px-4 lg:px-8 py-5">類別</th>
                      <th className="px-4 lg:px-8 py-5">價格</th>
                      <th className="px-4 lg:px-8 py-5">庫存</th>
                      <th className="px-4 lg:px-8 py-5">狀態</th>
                      <th className="px-4 lg:px-8 py-5">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-50 text-sm">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-pink-50/30 transition-colors">
                        <td className="px-4 lg:px-8 py-5 flex items-center gap-4">
                          <img src={product.image} alt="" className={`w-12 h-12 rounded-xl ${product.imageFit === 'cover' ? 'object-cover' : 'object-contain'} bg-gray-100`} />
                          <span className="text-gray-800 font-bold">{product.name}</span>
                        </td>
                        <td className="px-4 lg:px-8 py-5 text-gray-500 font-medium">{product.category}</td>
                        <td className="px-4 lg:px-8 py-5 text-gray-800 font-bold">${product.price.toFixed(2)}</td>
                        <td className="px-4 lg:px-8 py-5 text-gray-500 whitespace-nowrap">{product.stock} 件</td>
                        <td className="px-4 lg:px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                            product.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                          }`}>
                            {product.stock > 10 ? '庫存充足' : '低庫存'}
                          </span>
                        </td>
                        <td className="px-4 lg:px-8 py-5">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                // 初始化編輯時，設置 _editedImages 為當前圖片陣列
                                const currentImages = product.images && product.images.length > 0 
                                  ? product.images 
                                  : [product.image];
                                setEditingProduct({
                                  ...product,
                                  _editedImages: currentImages
                                });
                                // 更新自定義類別列表（如果商品類別不在列表中）
                                if (product.category && !customCategories.includes(product.category)) {
                                  onCategoriesChange?.(prev => [...prev, product.category]);
                                }
                              }}
                              className="text-cute-secondary hover:text-cute-primary p-2 hover:bg-pink-50 rounded-lg transition-colors"
                              aria-label="編輯商品"
                            >
                              <Edit2 size={18} />
                            </button>
                            {onDeleteProduct && (
                              <button 
                                onClick={() => {
                                  if (window.confirm(`確定要刪除「${product.name}」嗎？此操作無法復原！`)) {
                                    setDeletingProductId(product.id);
                                    onDeleteProduct(product.id).then(() => {
                                      setDeletingProductId(null);
                                    }).catch((error) => {
                                      console.error('Delete failed:', error);
                                      alert('刪除失敗，請重試');
                                      setDeletingProductId(null);
                                    });
                                  }
                                }}
                                disabled={deletingProductId === product.id}
                                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="刪除商品"
                              >
                                {deletingProductId === product.id ? (
                                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card View */}
              <div className="md:hidden p-4 space-y-4">
                {products.map((product) => (
                  <div key={product.id} className="bg-gray-50 rounded-2xl p-4 border border-pink-100">
                    <div className="flex items-start gap-4 mb-3">
                      <img src={product.image} alt="" className={`w-16 h-16 rounded-xl flex-shrink-0 ${product.imageFit === 'cover' ? 'object-cover' : 'object-contain'} bg-gray-100`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-gray-800 font-bold text-base mb-1 truncate">{product.name}</h4>
                        <p className="text-gray-500 text-sm">{product.category}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <span className="text-xs text-gray-500">價格</span>
                        <p className="text-lg font-bold text-cute-primary">${product.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">庫存</span>
                        <p className="text-lg font-bold text-gray-800">{product.stock} 件</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        product.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                      }`}>
                        {product.stock > 10 ? '庫存充足' : '低庫存'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            // 初始化編輯時，設置 _editedImages 為當前圖片陣列
                            const currentImages = product.images && product.images.length > 0 
                              ? product.images 
                              : [product.image];
                            setEditingProduct({
                              ...product,
                              _editedImages: currentImages
                            });
                            // 更新自定義類別列表（如果商品類別不在列表中）
                            if (product.category && !customCategories.includes(product.category)) {
                              onCategoriesChange?.(prev => [...prev, product.category]);
                            }
                          }}
                          className="text-cute-secondary hover:text-cute-primary p-2 hover:bg-pink-50 rounded-lg transition-colors"
                          aria-label="編輯商品"
                        >
                          <Edit2 size={18} />
                        </button>
                        {onDeleteProduct && (
                          <button 
                            onClick={() => {
                              if (window.confirm(`確定要刪除「${product.name}」嗎？此操作無法復原！`)) {
                                setDeletingProductId(product.id);
                                onDeleteProduct(product.id).then(() => {
                                  setDeletingProductId(null);
                                }).catch((error) => {
                                  console.error('Delete failed:', error);
                                  alert('刪除失敗，請重試');
                                  setDeletingProductId(null);
                                });
                              }
                            }}
                            disabled={deletingProductId === product.id}
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="刪除商品"
                          >
                            {deletingProductId === product.id ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'stats' && (
          <>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: '總銷售額', value: `$${totalSales.toFixed(2)}`, icon: DollarSign, color: 'bg-green-100 text-green-600' },
                { 
                  label: '待處理訂單', 
                  value: pendingOrdersCount.toString(), 
                  icon: Package, 
                  color: 'bg-blue-100 text-blue-600',
                  detail: orders.filter(o => o.status === 'pending')
                },
            { label: '顧客總數', value: uniqueCustomers.toString(), icon: Users, color: 'bg-purple-100 text-purple-600' },
            { label: '成長率', value: orders.length > 0 ? '+100%' : '0%', icon: TrendingUp, color: 'bg-pink-100 text-pink-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-pink-50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400 font-bold text-sm uppercase tracking-wider">{stat.label}</span>
                <div className={`p-3 rounded-2xl ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                  {stat.detail && stat.detail.length > 0 && stat.label === '待處理訂單' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 max-h-32 overflow-y-auto">
                      {stat.detail.slice(0, 3).map((order: any, idx: number) => (
                        <div key={idx} className="text-xs bg-blue-50 p-2 rounded-lg">
                          <div className="font-bold text-blue-800">訂單 #{order.id?.slice(-6)}</div>
                          <div className="text-gray-600">
                            {order.items?.map((item: any, i: number) => (
                              <div key={i}>• {item.name} x{item.quantity}</div>
                            ))}
                            <div className="font-bold text-gray-800 mt-1">總計: ${order.total?.toFixed(2) || '0.00'}</div>
                            {order.shippingInfo && (
                              <div className="mt-2 pt-2 border-t border-blue-200">
                                <div className="font-bold text-blue-700 text-xs mb-1">收貨資訊：</div>
                                <div className="text-gray-600">{order.shippingInfo.name}</div>
                                <div className="text-gray-600">{order.shippingInfo.phone}</div>
                                <div className="text-gray-600">{order.shippingInfo.country} {order.shippingInfo.city} {order.shippingInfo.postalCode}</div>
                                <div className="text-gray-600">{order.shippingInfo.address}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {stat.detail.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">...還有 {stat.detail.length - 3} 筆訂單</div>
                      )}
                    </div>
                  )}
            </div>
          ))}
        </div>

            {/* 數據重置按鈕 */}
            <div className="mb-8 flex justify-end">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg"
              >
                <RotateCcw size={18} /> 重置所有資料
              </button>
            </div>
            
            {/* Charts Section - 只在有數據時顯示 */}
            {(orders.length > 0 || products.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-8 rounded-3xl border border-pink-50 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">營收概覽</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} />
                  <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFF', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#FF90BC" strokeWidth={3} dot={{ r: 6, fill: '#FF90BC', strokeWidth: 2, stroke: '#FFF' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-pink-50 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">庫存分類</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} />
                  <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#FFF5F7' }}
                    contentStyle={{ backgroundColor: '#FFF', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#8ACDD7" radius={[8, 8, 8, 8]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
            )}
          </>
        )}

        {activeTab === 'marquee' && (
          <>
            {/* 跑馬燈內容管理 */}
            <div className="bg-white rounded-3xl border border-pink-50 shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-pink-50 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-cute-primary" />
                    跑馬燈內容管理
                  </h3>
                  {!isEditingMarquee && (
                    <button
                      onClick={() => {
                        setIsEditingMarquee(true);
                        loadMarqueeMessages();
                      }}
                      className="bg-cute-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-400 transition-colors active:scale-95"
                    >
                      <Edit2 size={18} /> 編輯內容
                    </button>
                  )}
          </div>
              </div>
              <div className="p-6">
                {isEditingMarquee ? (
                  <div className="space-y-4">
                    {isLoadingMarquee ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-cute-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-gray-500">載入中...</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {marqueeMessages.map((msg, index) => (
                            <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-pink-100">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-gray-500 font-bold">訊息 {index + 1}</span>
                                  <div className="flex-1 flex flex-wrap gap-1">
                                    {emojis.map((emoji) => (
                      <button 
                                        key={emoji}
                                        onClick={() => insertEmoji(index, emoji)}
                                        className="text-xl hover:scale-125 transition-transform active:scale-150"
                                        title={`插入 ${emoji}`}
                                      >
                                        {emoji}
                      </button>
                ))}
          </div>
        </div>
                                <input
                                  type="text"
                                  value={msg}
                                  onChange={(e) => updateMarqueeMessage(index, e.target.value)}
                                  placeholder="輸入跑馬燈訊息..."
                                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none focus:ring-2 focus:ring-pink-100"
                                />
      </div>
                              <button
                                onClick={() => removeMarqueeMessage(index)}
                                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label="刪除此訊息"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {/* 跑馬燈速度調整 */}
                        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <label className="block text-sm font-bold text-gray-700 mb-3">
                            跑馬燈速度: {marqueeSpeed} 秒
                          </label>
                          <input
                            type="range"
                            min="5"
                            max="60"
                            value={marqueeSpeed}
                            onChange={(e) => setMarqueeSpeed(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cute-primary"
                            aria-label="跑馬燈速度調整"
                            title="調整跑馬燈速度"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>快 (5秒)</span>
                            <span>慢 (60秒)</span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={addMarqueeMessage}
                            className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus size={18} /> 新增訊息
                          </button>
                          <button
                            onClick={() => setIsEditingMarquee(false)}
                            className="bg-gray-100 text-gray-600 font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveMarquee}
                            disabled={isSavingMarquee}
                            className="bg-cute-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingMarquee ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                儲存中...
                              </>
                            ) : (
                              <>
                                <Save size={18} /> 儲存
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isLoadingMarquee ? (
                      <p className="text-gray-400 text-center py-8">載入中...</p>
                    ) : marqueeMessages.length > 0 ? (
                      marqueeMessages.map((msg, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg text-gray-700">
                          {msg || '(空白訊息)'}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">目前沒有設定跑馬燈內容</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <>
            <div className="bg-white rounded-3xl border border-pink-50 shadow-sm overflow-x-auto p-4 md:p-8 mt-4">
              <h2 className="text-xl md:text-2xl font-black mb-4 md:mb-6 text-cute-primary flex items-center gap-2">
                <Users className="w-6 h-6 md:w-7 md:h-7 text-cute-primary" /> 會員管理
              </h2>
              {isLoadingUsers ? (
                <div className="text-center text-gray-400 py-12">載入中...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[600px] w-full text-xs md:text-sm border rounded-xl overflow-hidden">
                    <thead className="bg-pink-50 text-gray-500 text-[10px] md:text-xs uppercase font-bold tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="px-2 md:px-4 py-2 md:py-3 w-12"></th>
                        <th className="px-2 md:px-4 py-2 md:py-3 w-32 break-all">姓名</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 w-48 break-all">Gmail</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 w-28 break-all">電話</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 w-40 break-all">登入時間</th>
                      </tr>
                    </thead>
                    <tbody className="break-all">
                      {userList.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-gray-400 py-6">尚無會員資料</td></tr>
                      )}
                      {userList.map((user) => {
                        const isExpanded = expandedUsers.has(user.userId);
                        return (
                          <React.Fragment key={user.userId || user.id}>
                            <tr className="border-b hover:bg-pink-50/30 cursor-pointer" onClick={() => {
                              const newExpanded = new Set(expandedUsers);
                              if (isExpanded) {
                                newExpanded.delete(user.userId);
                              } else {
                                newExpanded.add(user.userId);
                              }
                              setExpandedUsers(newExpanded);
                            }}>
                              <td className="px-2 md:px-4 py-2 text-center">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </td>
                              <td className="px-2 md:px-4 py-2 break-all font-medium">{user.name || '-'}</td>
                              <td className="px-2 md:px-4 py-2 break-all">{user.email || '-'}</td>
                              <td className="px-2 md:px-4 py-2 break-all">{user.phone || '-'}</td>
                              <td className="px-2 md:px-4 py-2 break-all">
                                {user.lastLoginTime 
                                  ? new Date(user.lastLoginTime).toLocaleString('zh-TW', { 
                                      year: 'numeric', 
                                      month: '2-digit', 
                                      day: '2-digit', 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })
                                  : '-'}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={5} className="px-4 md:px-8 py-6 bg-gray-50">
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">詳細資料</h3>
                                    
                                    {/* 基本資訊 */}
                                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center border-b border-gray-200 pb-2">
                                          <span className="text-sm font-bold text-gray-700 w-24 flex-shrink-0">姓名：</span>
                                          <span className="text-sm text-gray-900 font-medium">{user.name || '-'}</span>
                                        </div>
                                        <div className="flex items-center border-b border-gray-200 pb-2">
                                          <span className="text-sm font-bold text-gray-700 w-24 flex-shrink-0">電話：</span>
                                          <span className="text-sm text-gray-900 font-medium">{user.phone || '-'}</span>
                                        </div>
                                        <div className="flex items-center border-b border-gray-200 pb-2">
                                          <span className="text-sm font-bold text-gray-700 w-24 flex-shrink-0">生日：</span>
                                          <span className="text-sm text-gray-900 font-medium">{user.birthday || '-'}</span>
                                        </div>
                                        <div className="flex items-center border-b border-gray-200 pb-2">
                                          <span className="text-sm font-bold text-gray-700 w-24 flex-shrink-0">性別：</span>
                                          <span className="text-sm text-gray-900 font-medium">
                                            {user.gender === 'male' ? '男性' : user.gender === 'female' ? '女性' : user.gender === 'other' ? '其他' : '-'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 地址資訊 */}
                                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                      <span className="text-sm font-bold text-gray-700 block mb-3">地址：</span>
                                      <div className="text-sm text-gray-900 bg-white p-4 rounded-lg border border-gray-200 font-medium">
                                        {user.country || ''} {user.city || ''} {user.postalCode || ''}<br />
                                        {user.address || '-'}
                                      </div>
                                    </div>

                                    {/* 緊急聯絡人 */}
                                    {(user.emergencyContact || user.emergencyPhone) && (
                                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                        <span className="text-sm font-bold text-gray-700 block mb-3">緊急聯絡人：</span>
                                        <div className="text-sm text-gray-900 bg-white p-4 rounded-lg border border-gray-200 font-medium">
                                          {user.emergencyContact || '-'} / {user.emergencyPhone || '-'}
                                        </div>
                                      </div>
                                    )}

                                    {/* 付款資訊（從訂單中取得） */}
                                    {user.orders && user.orders.length > 0 && (
                                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                        <span className="text-sm font-bold text-gray-700 block mb-3">付款資訊（最近一筆訂單）：</span>
                                        {user.orders
                                          .filter(o => o.paymentInfo)
                                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                          .slice(0, 1)
                                          .map((order, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                                              <div className="flex items-center border-b border-gray-100 pb-2">
                                                <span className="text-sm font-bold text-gray-700 w-28 flex-shrink-0">持卡人：</span>
                                                <span className="text-sm text-gray-900 font-medium">{order.paymentInfo?.cardholderName || '-'}</span>
                                              </div>
                                              <div className="flex items-center border-b border-gray-100 pb-2">
                                                <span className="text-sm font-bold text-gray-700 w-28 flex-shrink-0">卡號：</span>
                                                <span className="text-sm text-gray-900 font-medium">
                                                  **** **** **** {order.paymentInfo?.cardNumber?.slice(-4) || '****'}
                                                </span>
                                              </div>
                                              <div className="flex items-center">
                                                <span className="text-sm font-bold text-gray-700 w-28 flex-shrink-0">有效期限：</span>
                                                <span className="text-sm text-gray-900 font-medium">{order.paymentInfo?.expiryDate || '-'}</span>
                                              </div>
                                            </div>
                                          ))}
                                        {user.orders.filter(o => o.paymentInfo).length === 0 && (
                                          <div className="text-sm text-gray-500 bg-white p-4 rounded-lg border border-gray-200 text-center">尚無付款資訊</div>
                                        )}
                                      </div>
                                    )}

                                    {/* 訂單列表 */}
                                    {user.orders && user.orders.length > 0 && (
                                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-gray-300">
                                          <span className="text-base font-bold text-gray-800">訂單紀錄</span>
                                          <span className="text-sm font-bold text-gray-600">
                                            共 {user.orders.length} 筆，總金額 <span className="text-cute-primary">${user.orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}</span>
                                          </span>
                                        </div>
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                          {user.orders
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((order) => (
                                              <div key={order.id} className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-cute-primary transition-colors">
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3 pb-3 border-b border-gray-200">
                                                  <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-bold text-gray-900">訂單 #{order.id?.slice(-8) || 'N/A'}</span>
                                                    <span className="text-xs text-gray-500">
                                                      {new Date(order.date).toLocaleString('zh-TW', { 
                                                        year: 'numeric', 
                                                        month: '2-digit', 
                                                        day: '2-digit', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                      })}
                                                    </span>
                                                  </div>
                                                  <span className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                                                    order.status === 'shipped' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                                    order.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-300' :
                                                    'bg-gray-100 text-gray-800 border border-gray-300'
                                                  }`}>
                                                    {order.status === 'pending' ? '待處理' :
                                                     order.status === 'shipped' ? '已出貨' :
                                                     order.status === 'completed' ? '已完成' :
                                                     order.status === 'cancelled' ? '已取消' : order.status}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                  <div>
                                                    <span className="text-gray-600 font-medium">商品數量：</span>
                                                    <span className="text-gray-900 font-bold ml-1">{order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} 件</span>
                                                  </div>
                                                  <div className="text-right">
                                                    <span className="text-gray-600 font-medium">總金額：</span>
                                                    <span className="text-cute-primary font-bold text-base ml-1">${order.total?.toFixed(2) || '0.00'}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                    {(!user.orders || user.orders.length === 0) && (
                                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <span className="text-sm text-gray-500 font-medium">尚無訂單紀錄</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* 重置確認 Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isResetting && setShowResetConfirm(false)} />
            <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">確認重置資料</h3>
              <p className="text-gray-600 mb-6">這將刪除所有商品、訂單和許願資料，並恢復為預設商品。此操作無法復原！</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setIsResetting(true);
                    try {
                      if (onResetData) await onResetData();
                      setShowResetConfirm(false);
                      alert('資料已重置！');
                    } catch (error) {
                      alert('重置失敗，請重試');
                      console.error(error);
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  disabled={isResetting}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isResetting ? '重置中...' : '確認重置'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Add Product Modal */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => { setIsAddingProduct(false); setNewProduct(null); }} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] -mt-4 sm:mt-0" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'pan-y' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">新增商品</h2>
              <button onClick={() => { setIsAddingProduct(false); setNewProduct(null); }} className="text-gray-400 hover:text-gray-600" aria-label="關閉">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              {/* Image Upload/Preview - 支援多張圖片 */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 mb-2">商品圖片</label>
                {/* 顯示已上傳的圖片 */}
                {newProductImages.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {newProductImages.map((img, index) => (
                      <div key={index} className="relative">
                        <img src={img} alt={`Preview ${index + 1}`} className="w-20 h-20 rounded-xl object-cover border border-gray-200 bg-gray-50" />
                        <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                          {index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = newProductImages.filter((_, i) => i !== index);
                            setNewProductImages(newImages);
                            if (newImages.length > 0) {
                              setNewProductImagePreview(newImages[0]);
                              setNewProduct(prev => prev ? { ...prev, image: newImages[0] } : null);
                            } else {
                              setNewProductImagePreview('');
                              setNewProduct(prev => prev ? { ...prev, image: 'https://via.placeholder.com/400' } : null);
                            }
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-10"
                          aria-label="刪除圖片"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 上傳新圖片 */}
                <label className="flex items-center justify-center w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors active:bg-gray-200">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><Upload size={16}/> 上傳圖片</span>
                  <input 
                    type="file" 
                    id="new-product-image-input"
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, true)}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1">支援相機拍照或從相簿選擇，可上傳多張圖片</p>
                <div className="mt-2">
                  <label htmlFor="new-product-image-fit-select" className="block text-xs font-bold text-gray-600 mb-1">圖片顯示方式</label>
                  <select
                    id="new-product-image-fit-select"
                    value={newProduct?.imageFit || 'contain'}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, imageFit: e.target.value as 'cover' | 'contain' }))}
                    className="w-full bg-gray-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  >
                    <option value="contain">完整顯示（不裁切）</option>
                    <option value="cover">填滿（可能裁切，可拖拉調整位置）</option>
                  </select>
                  {newProduct?.imageFit === 'cover' && (
                    <p className="text-xs text-gray-500 mt-1">提示：使用 cover 模式時，可在商品詳情頁面拖拉圖片調整顯示位置</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="product-name" className="block text-sm font-bold text-gray-600 mb-1">名稱 *</label>
                <input 
                  id="product-name"
                  type="text" 
                  value={newProduct?.name || ''}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  required
                />
              </div>
              <div>
                <label htmlFor="product-category" className="block text-sm font-bold text-gray-600 mb-1">類別 *</label>
                <select
                  id="product-category"
                  value={newProduct?.category || customCategories[0] || 'Custom'}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  required
                >
                  {customCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'Sci-Fi' ? '科幻' : 
                       cat === 'Fantasy' ? '奇幻' : 
                       cat === 'Anime' ? '動漫' : 
                       cat === 'Custom' ? '客製化' : cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-price" className="block text-sm font-bold text-gray-600 mb-1">價格 ($) *</label>
                  <input 
                    id="product-price"
                    type="number" 
                    step="0.01"
                    value={newProduct?.price || ''}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                    className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="product-stock" className="block text-sm font-bold text-gray-600 mb-1">庫存 *</label>
                  <input 
                    id="product-stock"
                    type="number" 
                    value={newProduct?.stock || ''}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, stock: parseInt(e.target.value) }))}
                    className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                    required
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="product-description" className="block text-sm font-bold text-gray-600 mb-1">描述</label>
                <textarea 
                  id="product-description"
                  value={newProduct?.description || ''}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full h-24 bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => { setIsAddingProduct(false); setNewProduct(null); }}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={isUploadingImage}
                  className="flex-1 bg-cute-primary text-white font-bold py-3 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingImage ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      處理圖片中...
                    </>
                  ) : (
                    <>
                      <Save size={18} /> 新增商品
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] -mt-4 sm:mt-0" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'pan-y' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">編輯商品</h2>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600" aria-label="關閉">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleEditSave} className="space-y-4">
              {/* Image Upload/Preview */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 mb-2">商品圖片</label>
                {/* 顯示現有圖片 - 可拖拽排序 */}
                <div className="flex flex-wrap gap-3 mb-3">
                  {(() => {
                    const currentImages = (editingProduct as any)._editedImages !== undefined
                      ? (editingProduct as any)._editedImages
                      : (editingProduct.images && editingProduct.images.length > 0 ? editingProduct.images : [editingProduct.image]);
                    
                    const handleDragStart = (e: React.DragEvent, index: number) => {
                      setDraggedImageIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                    };
                    
                    const handleDragOver = (e: React.DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    };
                    
                    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
                      e.preventDefault();
                      if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
                        setDraggedImageIndex(null);
                        return;
                      }
                      
                      const newImages = [...currentImages];
                      const [removed] = newImages.splice(draggedImageIndex, 1);
                      newImages.splice(dropIndex, 0, removed);
                      
                      setEditingProduct({...editingProduct, _editedImages: newImages});
                      setDraggedImageIndex(null);
                    };
                    
                    return currentImages.map((img: string, index: number) => (
                      <div 
                        key={index} 
                        className="relative cursor-move"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <img 
                          src={img} 
                          alt={`Preview ${index + 1}`} 
                          className={`w-20 h-20 rounded-xl ${editingProduct.imageFit === 'cover' ? 'object-cover' : 'object-contain'} border border-gray-200 bg-gray-50 ${draggedImageIndex === index ? 'opacity-50' : ''}`}
                          draggable={false}
                        />
                        <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                          {index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newImages = currentImages.filter((_: any, i: number) => i !== index);
                            // 允許完全刪除所有圖片
                            setEditingProduct({...editingProduct, _editedImages: newImages.length > 0 ? newImages : []});
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-10"
                          aria-label="刪除圖片"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
                {/* 上傳新圖片 */}
                <label className="flex items-center justify-center w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors active:bg-gray-200">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><Upload size={16}/> 上傳圖片</span>
                  <input 
                    type="file" 
                    id="edit-product-image-input"
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) {
                        alert('請選擇圖片檔案');
                        e.target.value = '';
                        return;
                      }
                      setIsUploadingImage(true);
                      try {
                        const compressedBase64 = await compressImage(file);
                        const currentImages = (editingProduct as any)._editedImages || 
                                             (editingProduct.images && editingProduct.images.length > 0 ? editingProduct.images : [editingProduct.image]);
                        
                        // 限制最多5張圖片，避免超過Firestore 1MB限制
                        if (currentImages.length >= 5) {
                          alert('最多只能上傳5張圖片！');
                          setIsUploadingImage(false);
                          e.target.value = '';
                          return;
                        }
                        
                        // 檢查總大小（估算）
                        const estimatedTotalSize = (currentImages.length + 1) * 150 * 1024; // 每張約150KB
                        if (estimatedTotalSize > 900 * 1024) { // 預留100KB給其他資料
                          alert('圖片總大小過大，請減少圖片數量或使用更小的圖片！');
                          setIsUploadingImage(false);
                          e.target.value = '';
                          return;
                        }
                        
                        const newImages = [...currentImages, compressedBase64];
                        setEditingProduct({...editingProduct, _editedImages: newImages});
                      } catch (error: any) {
                        alert(`圖片處理失敗：${error.message || '請重試'}`);
                      } finally {
                        setIsUploadingImage(false);
                        e.target.value = '';
                      }
                    }}
                  />
                    </label>
                <p className="text-xs text-gray-400 mt-1">支援相機拍照或從相簿選擇，可上傳多張圖片</p>
                <div className="mt-2">
                  <label htmlFor="edit-product-image-fit-select" className="block text-xs font-bold text-gray-600 mb-1">圖片顯示方式</label>
                  <select
                    id="edit-product-image-fit-select"
                    value={editingProduct.imageFit || 'contain'}
                    onChange={(e) => setEditingProduct({...editingProduct, imageFit: e.target.value as 'cover' | 'contain'})}
                    className="w-full bg-gray-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary mb-2"
                  >
                    <option value="contain">完整顯示（不裁切）</option>
                    <option value="cover">填滿（可能裁切）</option>
                  </select>
                  {editingProduct.imageFit === 'cover' && (
                    <p className="text-xs text-gray-500 mt-1">提示：使用 cover 模式時，可在商品詳情頁面拖拉圖片調整顯示位置</p>
                  )}
                 </div>
              </div>

              <div>
                <label htmlFor="edit-product-name" className="block text-sm font-bold text-gray-600 mb-1">名稱</label>
                <input 
                  id="edit-product-name"
                  type="text" 
                  value={editingProduct.name} 
                  onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                />
              </div>
              <div>
                <label htmlFor="edit-product-category" className="block text-sm font-bold text-gray-600 mb-1">類別</label>
                <select
                  id="edit-product-category"
                  value={editingProduct.category || customCategories[0] || 'Custom'}
                  onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                >
                  {customCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'Sci-Fi' ? '科幻' : 
                       cat === 'Fantasy' ? '奇幻' : 
                       cat === 'Anime' ? '動漫' : 
                       cat === 'Custom' ? '客製化' : cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-product-price" className="block text-sm font-bold text-gray-600 mb-1">價格 ($)</label>
                  <input 
                    id="edit-product-price"
                    type="number" 
                    step="0.01"
                    value={editingProduct.price} 
                    onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                    className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  />
                </div>
                <div>
                  <label htmlFor="edit-product-stock" className="block text-sm font-bold text-gray-600 mb-1">庫存</label>
                  <input 
                    id="edit-product-stock"
                    type="number" 
                    value={editingProduct.stock} 
                    onChange={(e) => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                    className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="edit-product-description" className="block text-sm font-bold text-gray-600 mb-1">描述</label>
                <textarea 
                  id="edit-product-description"
                  value={editingProduct.description} 
                  onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                  className="w-full h-24 bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={isUploadingImage}
                  className="flex-1 bg-cute-primary text-white font-bold py-3 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingImage ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      處理圖片中...
                    </>
                  ) : (
                    <>
                  <Save size={18} /> 儲存變更
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        )}

      {/* 新增類別 Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowAddCategoryModal(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <Plus className="w-6 h-6 text-cute-primary" />
                新增商品類別
              </h2>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-pink-50 rounded-full transition-colors"
                aria-label="關閉"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newCategoryName && newCategoryName.trim()) {
                const categoryValue = newCategoryName.trim();
                if (!customCategories.includes(categoryValue)) {
                  const updatedCategories = [...customCategories, categoryValue];
                  onCategoriesChange?.(updatedCategories);
                  setShowAddCategoryModal(false);
                  setNewCategoryName('');
                } else {
                  alert('此類別已存在！');
                }
              }
            }}>
              <div className="mb-6">
                <label htmlFor="new-category-input" className="block text-sm font-bold text-gray-600 mb-2">
                  類別名稱
                </label>
                <input
                  id="new-category-input"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="請輸入新類別名稱"
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  autoFocus
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-cute-primary text-white font-bold py-3 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminPanel;