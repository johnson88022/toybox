import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import ChatBot from './components/ChatBot';
import DreamFactory from './components/DreamFactory';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import ProductDetail from './components/ProductDetail';
import MyOrders from './components/MyOrders';
import { Product, CartItem, User, Order, ShippingInfo, PaymentInfo } from './types';
import { MOCK_PRODUCTS } from './constants';
import { Trash2, CreditCard, ShoppingBag, X, LogIn, Apple, Smartphone, Loader2, LogOut, Settings, AlertTriangle, Copy } from 'lucide-react';
import { auth, googleProvider, appleProvider, isFirebaseConfigured } from './firebaseConfig';
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  listenProducts, addProduct, updateProduct as updateProductFS, deleteProduct as deleteProductFS, listenWishes, addWish, listenOrders, addOrderAndUpdateStock, initializeProducts, resetAllData, getUserProfile, updateOrderStatus as updateOrderStatusFS, listenMarqueeMessages
} from './firestoreHelpers';

// Main App Component
const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]); // Track sales for admin
  const [wishes, setWishes] = useState<any[]>([]);
  const [marqueeMessages, setMarqueeMessages] = useState<string[]>([
    '🎉 限時優惠！全館商品享特價優惠',
    '✨ 新會員註冊送100元購物金',
    '🚀 滿500元免運費',
    '💝 買二送一，數量有限',
    '🎁 精選商品最低5折起'
  ]);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Cart, 2: Shipping Info, 3: Payment, 4: Processing, 5: Success
  const [currentPage, setCurrentPage] = useState('/');
  const [showAddCartToast, setShowAddCartToast] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部'); // 商品分類篩選
  const [sortBy, setSortBy] = useState<string>('newest'); // 排序方式：newest, price-asc, price-desc, name-asc, name-desc
  
  // Checkout form states
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '台灣'
  });
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: ''
  });
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false); // Loading state for login
  const [loginError, setLoginError] = useState('');

  // Setup Guide State
  const [showConfigGuide, setShowConfigGuide] = useState(!isFirebaseConfigured);

  // Firestore 雲端同步監聽
  useEffect(() => {
    // 初始化商品資料（如果 Firestore 是空的）
    initializeProducts(MOCK_PRODUCTS).catch(console.error);
    
    // 監聽所有 Firestore 集合
    const unsubProducts = listenProducts((products) => {
      console.log('Products updated from Firestore:', products.length);
      // 移除 _createdAtTime 輔助欄位
      const cleanedProducts = products.map(({ _createdAtTime, ...rest }) => rest);
      setProducts(cleanedProducts as Product[]);
    });
    
    const unsubWishes = listenWishes((wishes) => {
      console.log('Wishes updated from Firestore:', wishes.length);
      setWishes(wishes);
    });
    
    const unsubOrders = listenOrders((orders) => {
      console.log('Orders updated from Firestore:', orders.length);
      setOrders(orders as Order[]);
    });
    
    const unsubMarquee = listenMarqueeMessages((messages) => {
      console.log('Marquee messages updated from Firestore:', messages.length);
      if (messages && messages.length > 0) {
        setMarqueeMessages(messages);
      }
    });
    
    return () => {
      unsubProducts();
      unsubWishes();
      unsubOrders();
      unsubMarquee();
    };
  }, []);

  // 監聽 Firebase 登入狀態
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Check strict admin email
        const isAdmin = firebaseUser.email === 'johnson88022@gmail.com';
        
        const appUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '使用者',
          email: firebaseUser.email || '',
          role: isAdmin ? 'admin' : 'customer',
          avatar: firebaseUser.photoURL || undefined
        };
        
        setUser(appUser);
        setIsLoginModalOpen(false); // 確保登入後關閉視窗
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Cart Functions (local)
  const addToCart = (product: Product, quantity: number = 1) => {
    // 檢查庫存
    const currentInCart = cart.find(item => item.id === product.id)?.quantity || 0;
    const totalQuantity = currentInCart + quantity;
    
    if (product.stock === 0) {
      alert('此商品目前缺貨！');
      return;
    }
    
    if (totalQuantity > product.stock) {
      alert(`庫存不足！目前僅剩 ${product.stock} 件，購物車中已有 ${currentInCart} 件。`);
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
    setShowAddCartToast(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  // Auth Logic - Email/Password
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    
    setIsLoggingIn(true);
    setLoginError('');
    
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // onAuthStateChanged will handle the state update
    } catch (error: any) {
      console.error("Email Login Error:", error);
      setLoginError('登入失敗，請檢查您的帳號密碼。');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Auth Logic - Social (Google/Apple)
  const handleSocialLogin = async (providerName: 'Google' | 'Apple') => {
    if (!isFirebaseConfigured) {
      alert("Firebase 尚未設定完成，請檢查 firebaseConfig.ts");
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    
    const provider = providerName === 'Google' ? googleProvider : appleProvider;

    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle the state update
    } catch (error: any) {
      console.error(`${providerName} Login Error:`, error);
      
      if (error.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        setLoginError(`網域未授權 (${hostname})。請至 Firebase Console > Authentication > Settings > Authorized domains 新增此網域。`);
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('登入已取消');
      } else {
        setLoginError(`${providerName} 登入失敗: ${error.message}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCart([]); // Clear cart on logout
      setCurrentPage('/');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };
  
  // Checkout Process
  const handleCheckout = async () => {
    if (!user) {
      setIsCartOpen(false);
      setIsLoginModalOpen(true);
      return;
    }
    
    // 嘗試從用戶基本資料自動填充收貨資訊
    try {
      const userProfile = await getUserProfile(user.id);
      if (userProfile) {
        setShippingInfo({
          name: userProfile.name || user.name || '',
          phone: userProfile.phone || '',
          address: userProfile.address || '',
          city: userProfile.city || '',
          postalCode: userProfile.postalCode || '',
          country: userProfile.country || '台灣'
        });
      } else {
        // 如果沒有基本資料，至少填充姓名
        setShippingInfo(prev => ({
          ...prev,
          name: user.name || ''
        }));
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // 即使失敗也至少填充姓名
      setShippingInfo(prev => ({
        ...prev,
        name: user.name || ''
      }));
    }
    
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
    setCheckoutStep(1);
  };

  const handleShippingNext = () => {
    // 驗證收貨資訊
    if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address || !shippingInfo.city || !shippingInfo.postalCode) {
      alert('請填寫完整的收貨資訊');
      return;
    }
    setCheckoutStep(3); // 前往付款資訊
  };

  const processPayment = async () => {
    // 驗證付款資訊
    if (!paymentInfo.cardNumber || !paymentInfo.expiryDate || !paymentInfo.cvv || !paymentInfo.cardholderName) {
      alert('請填寫完整的付款資訊');
      return;
    }
    
    setCheckoutStep(4); // Processing
    // 保存購物車副本和總金額（在清空前）
    const cartCopy = [...cart];
    const totalCopy = cartCopy.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    const order: Order = {
      id: `ord-${Date.now()}`,
      userId: user ? user.id : 'none',
      items: cartCopy,
      total: totalCopy,
      date: new Date(),
      status: 'pending',
      shippingInfo: shippingInfo,
      paymentInfo: paymentInfo
    };

    await addOrderAndUpdateStock(order, cartCopy);

    setTimeout(() => {
      setCheckoutStep(5); // Success
      setCart([]); // 最後清空購物車
      // 重置表單
      setShippingInfo({
        name: '',
        phone: '',
        address: '',
        city: '',
        postalCode: '',
        country: '台灣'
      });
      setPaymentInfo({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: ''
      });
    }, 2000);
  };

  // wishes/products/orders add/edit 寫雲端
  const handleSubmitWish = async (wish: string) => {
    if (wish && wish.trim()) await addWish(wish.trim());
  };
  const handleAddProduct = async (p: Product) => { await addProduct(p); };
  const handleUpdateProduct = async (updated: Product) => { await updateProductFS(updated.id, updated); };
  const handleDeleteProduct = async (id: string) => { await deleteProductFS(id); };
  const handleUpdateOrderStatus = async (orderId: string, status: 'pending' | 'shipped' | 'completed' | 'cancelled') => { await updateOrderStatusFS(orderId, status); };
  const handleResetData = async () => { await resetAllData(); };

  // Route Protection
  useEffect(() => {
    if (currentPage === '/admin' && user?.role !== 'admin') {
      setCurrentPage('/');
    }
  }, [currentPage, user]);

  const renderContent = () => {
    // 商品詳情頁路由
    if (currentPage.startsWith('/product/')) {
      const productId = currentPage.replace('/product/', '');
      const product = products.find(p => p.id === productId);
      if (product) {
        return (
          <ProductDetail
            product={product}
            onClose={() => setCurrentPage('/')}
            onAddToCart={(p, q) => {
              addToCart(p, q);
              setCurrentPage('/'); // 加入購物車後關閉詳情頁
            }}
            user={user}
            onUpdateProduct={handleUpdateProduct}
            products={products}
          />
        );
      } else {
        return (
          <div className="pt-28 px-4 pb-12 text-center">
            <p className="text-gray-400 text-xl">商品不存在</p>
            <button onClick={() => setCurrentPage('/')} className="mt-4 text-cute-primary hover:underline">
              返回首頁
            </button>
          </div>
        );
      }
    }
    
    if (currentPage === '/dream-factory') {
      return <DreamFactory onAddToCart={addToCart} onSubmitWish={handleSubmitWish} />;
    }
    if (currentPage === '/my-orders' && user) {
      return (
        <MyOrders
          orders={orders}
          user={user}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onClose={() => setCurrentPage('/')}
          onNavigateToProduct={(productId) => setCurrentPage(`/product/${productId}`)}
        />
      );
    }
    if (currentPage === '/admin' && user?.role === 'admin') {
      return (
        <AdminPanel 
          products={products} 
          orders={orders}
          onUpdateProduct={handleUpdateProduct}
          onAddProduct={handleAddProduct}
          onDeleteProduct={handleDeleteProduct}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          wishes={wishes.map(w => typeof w === 'string' ? w : w.text || w)}
          onResetData={handleResetData}
        />
      );
    }
    // Default to Home
    const categories = ['全部', 'Sci-Fi', 'Fantasy', 'Anime', 'Custom'];
    let filteredProducts = selectedCategory === '全部' 
      ? products 
      : products.filter(p => p.category === selectedCategory);
    
    // 排序功能
    filteredProducts = [...filteredProducts].sort((a, b) => {
      switch(sortBy) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'name-asc':
          return a.name.localeCompare(b.name, 'zh-TW');
        case 'name-desc':
          return b.name.localeCompare(a.name, 'zh-TW');
        case 'newest':
        default:
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
      }
    });

    return (
      <main className="pt-28 px-4 pb-12 max-w-7xl mx-auto">
        {/* 廣告跑馬燈 */}
        {marqueeMessages.length > 0 && marqueeMessages.some(msg => msg.trim() !== '') && (
          <div className="mb-8 overflow-hidden bg-gradient-to-r from-cute-primary to-cute-secondary rounded-2xl shadow-lg">
            <div className="py-4 whitespace-nowrap animate-scroll">
              <div className="inline-flex items-center gap-8 text-white font-bold text-lg">
                {marqueeMessages.filter(msg => msg.trim() !== '').map((msg, i) => (
                  <span key={i} className="inline-block">{msg}</span>
                ))}
                {marqueeMessages.filter(msg => msg.trim() !== '').map((msg, i) => (
                  <span key={`dup-${i}`} className="inline-block">{msg}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-200/50 blur-[100px] rounded-full -z-10"></div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-gray-800">
            歡迎來到 <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cute-primary to-cute-secondary">ToyBox</span>
          </h1>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto font-medium">
            最可愛的公仔、雕像和收藏品聚集地。
            在我們精選的系列中找到您的快樂天地！ 🌸
          </p>
        </div>

        {/* 分類篩選和排序 */}
        <div className="mb-8 space-y-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-pink-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-gray-500 text-sm font-bold whitespace-nowrap">商品分類</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    selectedCategory === category
                      ? 'bg-cute-primary text-white shadow-lg shadow-pink-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-pink-100 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm font-bold whitespace-nowrap">排序方式</span>
              <div className="flex-1 h-px bg-gray-200"></div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border-2 border-pink-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-cute-primary focus:border-cute-primary transition-all min-w-[180px]"
              >
                <option value="newest">最新上架</option>
                <option value="price-asc">價格：低到高</option>
                <option value="price-desc">價格：高到低</option>
                <option value="name-asc">名稱：A-Z</option>
                <option value="name-desc">名稱：Z-A</option>
              </select>
            </div>
          </div>
        </div>

        {/* 商品列表 */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAddToCart={addToCart}
                onClick={() => setCurrentPage(`/product/${product.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 text-xl font-medium">目前沒有「{selectedCategory}」類別的商品</p>
          </div>
        )}
      </main>
    );
  };

  // Setup Guide UI (Shows if apiKey is missing)
  if (showConfigGuide) {
    return (
      <div className="min-h-screen bg-cute-bg flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden border border-pink-100">
          <div className="bg-gradient-to-r from-cute-primary to-cute-secondary p-8 text-white">
            <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
              <Settings className="w-8 h-8" />
              設定 ToyBox
            </h1>
            <p className="opacity-90">需要 Firebase 設定才能啟用 Google 和 Apple 登入。</p>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-yellow-600 w-6 h-6 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-yellow-800 mb-1">找不到 API Key</h3>
                <p className="text-sm text-yellow-700">
                  您目前使用的是預設的 placeholder 設定。請依照下方步驟設定您的 Firebase 專案。
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800">如何取得設定？</h2>
              <ol className="list-decimal list-inside space-y-3 text-gray-600 ml-2">
                <li>前往 <a href="https://console.firebase.google.com/" target="_blank" className="text-cute-primary font-bold hover:underline">Firebase Console</a> 並建立一個新專案。</li>
                <li>點選 <strong>Project settings (專案設定)</strong> (齒輪圖示)。</li>
                <li>在 <strong>General (一般)</strong> 頁面下方，找到 <strong>Your apps (您的應用程式)</strong>。</li>
                <li>點選 <strong>&lt;/&gt; (Web)</strong> 圖示來註冊應用程式。</li>
                <li>複製 <code>firebaseConfig</code> 物件中的內容。</li>
                <li>打開本專案中的 <code>firebaseConfig.ts</code> 檔案。</li>
                <li>將複製的內容貼上替換 <code>const firebaseConfig = ...</code> 的部分。</li>
              </ol>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-center text-gray-400 text-sm mb-4">完成設定後，請重新整理此頁面。</p>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                我已更新設定，重新整理
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cute-bg text-gray-800 font-sans selection:bg-cute-primary selection:text-white">
      <Navbar 
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} 
        onCartClick={() => setIsCartOpen(true)}
        user={user}
        onLoginClick={user ? handleLogout : () => setIsLoginModalOpen(true)}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onProfileClick={user ? () => setShowProfileModal(true) : undefined}
      />

      {renderContent()}

      <ChatBot />

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-pink-100 flex justify-between items-center bg-pink-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingBag className="text-cute-primary" /> 您的購物車
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="text-center text-gray-400 mt-20">
                  <ShoppingBag size={64} className="mx-auto mb-4 opacity-20 text-cute-primary" />
                  <p className="font-bold text-lg">您的購物車是空的！</p>
                  <p className="text-sm">是時候去購物了！ 🛍️</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-pink-100 shadow-sm">
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h4 className="text-gray-800 font-bold text-sm line-clamp-1">{item.name}</h4>
                      <p className="text-cute-primary font-bold text-sm">${item.price.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-red-50 rounded-full"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-white border-t border-pink-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-500 font-medium">總計</span>
                  <span className="text-3xl font-black text-gray-800">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handleCheckout}
                  className="w-full py-4 bg-cute-primary text-white font-bold rounded-xl hover:bg-pink-400 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  前往結帳
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isLoggingIn && setIsLoginModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            {isLoggingIn ? (
                <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="w-12 h-12 text-cute-primary animate-spin mb-4" />
                    <p className="text-gray-500 font-bold">正在連接安全伺服器...</p>
                </div>
            ) : (
                <>
                    <h2 className="text-3xl font-black text-gray-800 mb-2 text-center">你好！ 👋</h2>
                    <p className="text-gray-500 text-center mb-8">登入以繼續您的收藏之旅</p>
                    
                    {loginError && (
                      <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl text-center select-all">
                        {loginError}
                      </div>
                    )}

                    <div className="space-y-3 mb-6">
                        <button onClick={() => handleSocialLogin('Google')} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        使用 Google 登入
                        </button>
                        <button onClick={() => handleSocialLogin('Apple')} className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition-colors">
                        <Apple size={20} />
                        使用 Apple ID 登入
                        </button>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-gray-400 text-sm font-medium">或</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-4">
                    <input 
                        type="email" 
                        placeholder="電子郵件地址" 
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all"
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="密碼" 
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all"
                        required
                    />
                    <button 
                        type="submit"
                        className="w-full bg-cute-primary hover:bg-pink-400 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-pink-200"
                    >
                        登入
                    </button>
                    </form>
                </>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => { if(checkoutStep === 5) setIsCheckoutOpen(false); }} />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            
            {/* Progress Steps */}
            <div className="p-6 border-b border-pink-100 bg-pink-50">
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <React.Fragment key={step}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      checkoutStep >= step ? 'bg-cute-primary text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {checkoutStep > step ? '✓' : step}
                    </div>
                    {step < 5 && (
                      <div className={`h-1 w-12 ${checkoutStep > step ? 'bg-cute-primary' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span className={checkoutStep >= 1 ? 'text-cute-primary font-bold' : ''}>購物車</span>
                <span className={checkoutStep >= 2 ? 'text-cute-primary font-bold' : ''}>收貨資訊</span>
                <span className={checkoutStep >= 3 ? 'text-cute-primary font-bold' : ''}>付款資訊</span>
                <span className={checkoutStep >= 4 ? 'text-cute-primary font-bold' : ''}>處理中</span>
                <span className={checkoutStep >= 5 ? 'text-cute-primary font-bold' : ''}>完成</span>
              </div>
            </div>

            {/* Checkout Steps */}
            <div className="p-8 md:p-12">
              {/* Step 1: Cart Review */}
              {checkoutStep === 1 && (
                <div>
                  <h2 className="text-3xl font-black text-gray-800 mb-6">購物車確認</h2>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">{item.name}</h3>
                          <p className="text-sm text-gray-500">數量: {item.quantity} × ${item.price.toFixed(2)}</p>
                        </div>
                        <span className="font-bold text-cute-primary">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-6 border border-pink-100 bg-pink-50 rounded-2xl flex justify-between items-center mb-6">
                    <span className="text-gray-500 font-bold">總金額</span>
                    <span className="text-4xl font-black text-cute-primary">${cartTotal.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => setCheckoutStep(2)}
                    disabled={cart.length === 0}
                    className="w-full bg-cute-primary text-white font-bold py-4 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一步：填寫收貨資訊
                  </button>
                </div>
              )}

              {/* Step 2: Shipping Info */}
              {checkoutStep === 2 && (
                <div>
                  <h2 className="text-3xl font-black text-gray-800 mb-6">收貨資訊</h2>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">收貨人姓名 *</label>
                      <input 
                        type="text" 
                        value={shippingInfo.name}
                        onChange={(e) => setShippingInfo({...shippingInfo, name: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">聯絡電話 *</label>
                      <input 
                        type="tel" 
                        value={shippingInfo.phone}
                        onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">國家/地區 *</label>
                        <input 
                          type="text" 
                          value={shippingInfo.country}
                          onChange={(e) => setShippingInfo({...shippingInfo, country: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">縣市 *</label>
                        <input 
                          type="text" 
                          value={shippingInfo.city}
                          onChange={(e) => setShippingInfo({...shippingInfo, city: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">郵遞區號 *</label>
                      <input 
                        type="text" 
                        value={shippingInfo.postalCode}
                        onChange={(e) => setShippingInfo({...shippingInfo, postalCode: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">詳細地址 *</label>
                      <textarea 
                        value={shippingInfo.address}
                        onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none h-24 resize-none"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setCheckoutStep(1)}
                      className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      上一步
                    </button>
                    <button 
                      onClick={handleShippingNext}
                      className="flex-1 bg-cute-primary text-white font-bold py-4 rounded-xl hover:bg-pink-400 transition-colors shadow-lg active:scale-95"
                    >
                      下一步：付款資訊
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Payment Info */}
              {checkoutStep === 3 && (
                <div>
                  <h2 className="text-3xl font-black text-gray-800 mb-6">付款資訊</h2>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">持卡人姓名 *</label>
                      <input 
                        type="text" 
                        value={paymentInfo.cardholderName}
                        onChange={(e) => setPaymentInfo({...paymentInfo, cardholderName: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-800 focus:border-cute-primary focus:outline-none"
                        placeholder="與卡片上的姓名相同"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">信用卡號碼 *</label>
                      <input 
                        type="text" 
                        value={paymentInfo.cardNumber}
                        onChange={(e) => setPaymentInfo({...paymentInfo, cardNumber: e.target.value.replace(/\s/g, '')})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-800 focus:border-cute-primary focus:outline-none"
                        placeholder="1234 5678 9012 3456"
                        maxLength={16}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">有效期限 *</label>
                        <input 
                          type="text" 
                          value={paymentInfo.expiryDate}
                          onChange={(e) => setPaymentInfo({...paymentInfo, expiryDate: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-800 focus:border-cute-primary focus:outline-none"
                          placeholder="MM/YY"
                          maxLength={5}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">安全碼 (CVV) *</label>
                        <input 
                          type="text" 
                          value={paymentInfo.cvv}
                          onChange={(e) => setPaymentInfo({...paymentInfo, cvv: e.target.value.replace(/\D/g, '')})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-800 focus:border-cute-primary focus:outline-none"
                          placeholder="123"
                          maxLength={4}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border border-pink-100 bg-pink-50 rounded-2xl mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-bold">總金額</span>
                      <span className="text-3xl font-black text-cute-primary">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setCheckoutStep(2)}
                      className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      上一步
                    </button>
                    <button 
                      onClick={processPayment}
                      className="flex-1 bg-black text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95"
                    >
                      <CreditCard size={20} /> 確認付款
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Processing */}
              {checkoutStep === 4 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 border-8 border-cute-primary border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">處理中...</h3>
                  <p className="text-gray-500">正在連接到安全支付網關。</p>
                </div>
              )}

              {/* Step 5: Success */}
              {checkoutStep === 5 && (
                <div className="text-center py-8">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow">
                    <ShoppingBag className="text-green-500 w-12 h-12" />
                  </div>
                  <h2 className="text-4xl font-black text-gray-800 mb-4">太棒了！訂單已確認！</h2>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    非常感謝，{user?.name}！您的商品正在被細心包裝，很快就會寄出。 🎁
                  </p>
                  <button 
                    onClick={() => setIsCheckoutOpen(false)}
                    className="bg-cute-secondary text-white px-10 py-4 rounded-xl font-bold hover:bg-sky-400 transition-colors shadow-lg"
                  >
                    繼續購物
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfileModal && user && (
        <UserProfile 
          user={user} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}


    </div>
  );
};

export default App;