import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import ChatBot from './components/ChatBot';
import DreamFactory from './components/DreamFactory';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import ProductDetail from './components/ProductDetail';
import MyOrders from './components/MyOrders';
import MyCoupons from './components/MyCoupons';
import { Product, CartItem, User, Order, ShippingInfo, PaymentInfo, UserCoupon, Coupon } from './types';
// 不再使用預設商品
import { Trash2, CreditCard, ShoppingBag, X, LogIn, Apple, Smartphone, Loader2, LogOut, Settings, AlertTriangle, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { auth, googleProvider, appleProvider, isFirebaseConfigured } from './firebaseConfig';
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  listenProducts, addProduct, updateProduct as updateProductFS, deleteProduct as deleteProductFS, listenWishes, addWish, deleteWish, listenOrders, addOrderAndUpdateStock, initializeProducts, resetAllData, getUserProfile, updateUserProfile, updateOrderStatus as updateOrderStatusFS, listenMarqueeMessages, listenUserCoupons, useCoupon, grantCouponToUser, getUserOrders, listenCoupons
} from './firestoreHelpers';

// Main App Component
const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    // 從localStorage恢復購物車
    try {
      const savedCart = localStorage.getItem('toybox_cart');
      if (savedCart) {
        return JSON.parse(savedCart);
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
    }
    return [];
  });
  const [selectedCartItems, setSelectedCartItems] = useState<Set<string>>(new Set());
  const [cartItemQuantities, setCartItemQuantities] = useState<Map<string, number>>(new Map());
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
  const [marqueeSpeed, setMarqueeSpeed] = useState<number>(30);
  const [marqueeRepeatCount, setMarqueeRepeatCount] = useState<number>(8);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Cart, 2: Shipping Info, 3: Payment, 4: Processing, 5: Success
  const [currentPage, setCurrentPage] = useState('/');
  const [showAddCartToast, setShowAddCartToast] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部'); // 商品分類篩選
  const [sortBy, setSortBy] = useState<string>('newest'); // 排序方式：newest, price-asc, price-desc, name-asc, name-desc
  const [categoryExpanded, setCategoryExpanded] = useState(false); // 分類展開狀態
  const [sortExpanded, setSortExpanded] = useState(false); // 排序展開狀態
  const [customCategories, setCustomCategories] = useState<string[]>(['Sci-Fi', 'Fantasy', 'Anime', 'Custom']);
  
  // 優惠券相關 state
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null);
  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);

  // 監聽所有優惠券（用於自動發放檢查）
  useEffect(() => {
    const unsubscribe = listenCoupons((coupons) => {
      setAllCoupons(coupons);
    });
    return () => unsubscribe();
  }, []);

  // 檢查並自動發放優惠券
  const checkAndGrantAutoCoupons = async (userId: string, triggerType: 'register' | 'order', orderData?: Order) => {
    if (!userId || allCoupons.length === 0) return;

    try {
      const userOrders = await getUserOrders(userId);
      const userProfile = await getUserProfile(userId);
      const now = new Date();

      // 重新獲取用戶優惠券列表（確保是最新的）
      const currentUserCoupons: UserCoupon[] = [];
      const unsubscribe = listenUserCoupons(userId, (coupons) => {
        currentUserCoupons.splice(0, currentUserCoupons.length, ...coupons);
      });

      // 等待一小段時間讓監聽器更新
      await new Promise(resolve => setTimeout(resolve, 500));

      for (const coupon of allCoupons) {
        if (!coupon.isActive || !coupon.autoGrant?.enabled) continue;

        const validFrom = new Date(coupon.validFrom);
        const validUntil = new Date(coupon.validUntil);
        if (validUntil < now || validFrom > now) continue; // 已過期或尚未生效

        const condition = coupon.autoGrant;

        // 檢查是否已擁有此優惠券且未使用
        const existingCoupons = currentUserCoupons.filter(
          (uc) => uc.couponId === coupon.id && !uc.isUsed
        );
        if (existingCoupons.length > 0) continue; // 已擁有

        let shouldGrant = false;

        switch (condition.type) {
          case 'register':
            if (triggerType === 'register') {
              shouldGrant = true;
            }
            break;
          case 'firstOrder':
            if (triggerType === 'order' && userOrders.length === 1) {
              shouldGrant = true;
            }
            break;
          case 'orderAmount':
            if (triggerType === 'order' && orderData && orderData.total >= (condition.value || 0)) {
              shouldGrant = true;
            }
            break;
          case 'orderCount':
            if (triggerType === 'order' && userOrders.length >= (condition.value || 0)) {
              shouldGrant = true;
            }
            break;
          case 'totalSpent':
            const totalSpent = userOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            if (totalSpent >= (condition.value || 0)) {
              shouldGrant = true;
            }
            break;
          case 'birthday':
            if (userProfile?.birthday) {
              const birthday = new Date(userProfile.birthday);
              const currentMonth = now.getMonth();
              const birthdayMonth = birthday.getMonth();
              if (currentMonth === birthdayMonth) {
                shouldGrant = true;
              }
            }
            break;
        }

        if (shouldGrant) {
          try {
            await grantCouponToUser(userId, coupon.id, coupon);
            console.log(`✅ Auto-granted coupon "${coupon.name}" to user ${userId}`);
            // 觸發優惠券列表更新
            setTimeout(() => {
              const event = new CustomEvent('couponGranted');
              window.dispatchEvent(event);
            }, 500);
          } catch (error: any) {
            if (error.message !== '用戶已經擁有此優惠券') {
              console.error(`❌ Failed to grant coupon "${coupon.name}":`, error);
            }
          }
        }
      }

      unsubscribe();
    } catch (error) {
      console.error('Failed to check auto-grant coupons:', error);
    }
  };
  
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
  
  // Payment default save state
  const [savePaymentAsDefault, setSavePaymentAsDefault] = useState(false);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false); // Loading state for login
  const [loginError, setLoginError] = useState('');

  // Setup Guide State
  const [showConfigGuide, setShowConfigGuide] = useState(!isFirebaseConfigured);

  // 新增一個處理分類變更的函式
  const handleCategoriesChange = (categories: string[]) => {
    setCustomCategories(categories);
    // 若有 firestore 持久化分類，可在這裡寫入
  };

  // Firestore 雲端同步監聽
  useEffect(() => {
    // 不再自動初始化商品資料，讓賣家自行新增
    
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
    
    const unsubMarquee = listenMarqueeMessages((messages, speed, repeatCount) => {
      console.log('Marquee messages updated from Firestore:', messages.length);
      if (messages && messages.length > 0) {
        setMarqueeMessages(messages);
      } else {
        setMarqueeMessages([]);
      }
      if (speed !== undefined) {
        setMarqueeSpeed(speed);
      }
      if (repeatCount !== undefined) {
        setMarqueeRepeatCount(repeatCount);
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
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
        
        // 自動更新 userProfiles 的 email 和 lastLoginTime
        try {
          const existingProfile = await getUserProfile(firebaseUser.uid);
          const isNewUser = !existingProfile;
          
          await updateUserProfile({
            userId: firebaseUser.uid,
            name: existingProfile?.name || appUser.name,
            email: firebaseUser.email || '',
            phone: existingProfile?.phone || '',
            address: existingProfile?.address || '',
            city: existingProfile?.city || '',
            postalCode: existingProfile?.postalCode || '',
            country: existingProfile?.country || '台灣',
            birthday: existingProfile?.birthday || '',
            gender: existingProfile?.gender || undefined,
            emergencyContact: existingProfile?.emergencyContact || '',
            emergencyPhone: existingProfile?.emergencyPhone || '',
            lastLoginTime: new Date(), // 記錄登入時間
            updatedAt: new Date(),
          });
          
          // 如果是新用戶，檢查註冊優惠券
          if (isNewUser) {
            setTimeout(() => {
              checkAndGrantAutoCoupons(firebaseUser.uid, 'register');
            }, 1000);
          }
        } catch (error) {
          console.error('Failed to update user profile on login:', error);
        }
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 保存購物車到localStorage
  useEffect(() => {
    try {
      localStorage.setItem('toybox_cart', JSON.stringify(cart));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [cart]);

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
      const newCart = existing
        ? prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item)
        : [...prev, { ...product, quantity }];
      return newCart;
    });
    // 自動選中新加入的商品
    setSelectedCartItems(prev => new Set([...prev, product.id]));
    // 初始化選中商品的數量
    setCartItemQuantities(prev => {
      const newMap = new Map(prev);
      const existing = (newMap.get(product.id) as number | undefined) || 0;
      newMap.set(product.id, existing + quantity);
      return newMap;
    });
    setShowAddCartToast(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    setSelectedCartItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const cartTotal = cart.reduce((total, item) => {
    if (selectedCartItems.has(item.id)) {
      const checkoutQuantity = cartItemQuantities.get(item.id) || item.quantity;
      return total + (item.price * checkoutQuantity);
    }
    return total;
  }, 0);

  const selectedCartItemsList = cart.filter(item => selectedCartItems.has(item.id)).map(item => {
    const checkoutQuantity = cartItemQuantities.get(item.id) || item.quantity;
    return { ...item, quantity: checkoutQuantity };
  });

  // 計算優惠金額
  const calculateDiscount = (subtotal: number, coupon: UserCoupon | null): number => {
    if (!coupon || coupon.isUsed) return 0;
    const couponData = coupon.coupon;
    const now = new Date();
    const validUntil = new Date(couponData.validUntil);
    if (validUntil < now) return 0; // 已過期
    
    if (couponData.minPurchaseAmount && subtotal < couponData.minPurchaseAmount) {
      return 0; // 未達最低消費
    }

    if (couponData.type === 'discount') {
      const discount = (subtotal * (couponData.discount || 0)) / 100;
      if (couponData.maxDiscountAmount && discount > couponData.maxDiscountAmount) {
        return couponData.maxDiscountAmount;
      }
      return discount;
    } else if (couponData.type === 'fixedAmount') {
      return Math.min(couponData.fixedAmount || 0, subtotal);
    } else if (couponData.type === 'freeShipping') {
      // 免運券在結帳時處理，這裡返回 0
      return 0;
    }
    return 0;
  };

  // 計算總金額（含優惠）
  const calculateTotal = (): { subtotal: number; discount: number; shipping: number; total: number } => {
    const subtotal = selectedCartItemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = calculateDiscount(subtotal, selectedCoupon);
    const shipping = selectedCoupon?.coupon.type === 'freeShipping' ? 0 : (subtotal - discount >= 500 ? 0 : 100); // 假設滿 500 免運
    const total = Math.max(0, subtotal - discount + shipping);
    return { subtotal, discount, shipping, total };
  };

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
      // 清除當前用戶的付款資訊（如果有的話）
      if (user) {
        const paymentKey = `toybox_payment_info_${user.id}`;
        localStorage.removeItem(paymentKey);
      }
      await signOut(auth);
      setCart([]); // Clear cart on logout
      setSelectedCartItems(new Set()); // Clear selected items
      localStorage.removeItem('toybox_cart'); // Clear localStorage
      setPaymentInfo({ // 清除付款資訊
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: ''
      });
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
    
    // 載入儲存的付款資訊（使用 userId 區分不同用戶）
    try {
      const paymentKey = `toybox_payment_info_${user.id}`;
      const savedPayment = localStorage.getItem(paymentKey);
      if (savedPayment) {
        const parsedPayment = JSON.parse(savedPayment);
        setPaymentInfo(parsedPayment);
      }
    } catch (error) {
      console.error('Failed to load saved payment info:', error);
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
    // 只使用選中的商品進行結帳，使用調整後的數量
    const selectedItems = cart
      .filter(item => selectedCartItems.has(item.id))
      .map(item => {
        const checkoutQuantity = cartItemQuantities.get(item.id) || item.quantity;
        // 檢查庫存
        if (checkoutQuantity > item.stock) {
          throw new Error(`商品「${item.name}」的庫存不足！目前僅剩 ${item.stock} 件，您選擇了 ${checkoutQuantity} 件。`);
        }
        return { ...item, quantity: checkoutQuantity };
      });
    
    if (selectedItems.length === 0) {
      alert('請至少選擇一個商品進行結帳');
      setCheckoutStep(1);
      return;
    }
    
    const { subtotal, discount, shipping, total } = calculateTotal();
    
    const order: Order = {
          id: `ord-${Date.now()}`,
      userId: user ? user.id : 'none',
      items: selectedItems,
      total: total,
          date: new Date(),
      status: 'pending',
      shippingInfo: shippingInfo,
      paymentInfo: paymentInfo,
      ...(selectedCoupon?.id && { couponId: selectedCoupon.id }),
      ...(discount > 0 && { discountAmount: discount })
    };

    // 如果使用了優惠券，標記為已使用
    if (selectedCoupon && !selectedCoupon.isUsed) {
      try {
        await useCoupon(selectedCoupon.id, order.id);
      } catch (error) {
        console.error('Failed to mark coupon as used:', error);
      }
    }

    try {
      await addOrderAndUpdateStock(order, selectedItems);
      
      // 如果用戶選擇儲存付款資訊為預設（使用 userId 區分不同用戶）
      if (savePaymentAsDefault && user) {
        try {
          const paymentKey = `toybox_payment_info_${user.id}`;
          localStorage.setItem(paymentKey, JSON.stringify(paymentInfo));
        } catch (error) {
          console.error('Failed to save payment info to localStorage:', error);
        }
      }
    } catch (error: any) {
      alert(error.message || '結帳失敗，請重試');
      setCheckoutStep(1);
      return;
    }

    setTimeout(() => {
      setCheckoutStep(5); // Success
      // 更新購物車：移除已結帳的商品，或減少已結帳的數量
      setCart(prev => prev.map(item => {
        if (selectedCartItems.has(item.id)) {
          const checkoutQuantity = cartItemQuantities.get(item.id) || item.quantity;
          const remainingQuantity = item.quantity - checkoutQuantity;
          if (remainingQuantity <= 0) {
            return null; // 標記為移除
          }
          return { ...item, quantity: remainingQuantity };
        }
        return item;
      }).filter(item => item !== null) as CartItem[]);
      // 清除已結帳商品的選中狀態和數量
      setSelectedCartItems(prev => {
        const newSet = new Set(prev);
        selectedItems.forEach(item => newSet.delete(item.id));
        return newSet;
      });
      setCartItemQuantities(prev => {
        const newMap = new Map(prev);
        selectedItems.forEach(item => newMap.delete(item.id));
        return newMap;
      });
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
  const handleDeleteWish = async (wishId: string) => { await deleteWish(wishId); };
  const handleUpdateOrderStatus = async (orderId: string, status: 'pending' | 'shipped' | 'completed' | 'cancelled') => { await updateOrderStatusFS(orderId, status); };
  const handleResetData = async () => { await resetAllData(); };

  // Route Protection
  useEffect(() => {
    if (currentPage === '/admin' && user?.role !== 'admin') {
      setCurrentPage('/');
    }
  }, [currentPage, user]);

  // ESC鍵關閉結帳模態框
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCheckoutOpen && checkoutStep !== 4 && checkoutStep !== 5) {
        if (window.confirm('確定要取消結帳嗎？')) {
          setIsCheckoutOpen(false);
          setCheckoutStep(1);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCheckoutOpen, checkoutStep]);

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
    if (currentPage === '/my-coupons' && user) {
      return <MyCoupons userId={user.id} />;
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
          wishes={wishes}
          onDeleteWish={handleDeleteWish}
          onResetData={handleResetData}
          onCategoriesChange={handleCategoriesChange}
          customCategories={customCategories}
          currentUser={user}
        />
      );
    }
    // Default to Home - 使用自定義類別
    const categories = ['全部', ...customCategories];
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

    // 跑馬燈邏輯：
    // - marqueeSpeed 表示「基準重複次數（12 次時）整輪跑完需要的秒數」
    // - 實際動畫秒數會依照目前的 repeatCount 等比例放大或縮小，
    //   讓「文字在畫面中的移動速度」在不同重複次數下保持一致，不會因為重複次數變多就跑得超快
    const effectiveRepeatCount = Math.max(2, marqueeRepeatCount || 2);
    const baseRepeatForSpeed = 12;
    const repeatFactor = effectiveRepeatCount / baseRepeatForSpeed;
    const effectiveMarqueeDuration = marqueeSpeed * repeatFactor;

    return (
      <main className="pt-20 pb-12">
        {/* 廣告跑馬燈 - 全寬顯示，無限循環，從左邊開始，RWD適配 */}
        {marqueeMessages.length > 0 && marqueeMessages.some(msg => msg.trim() !== '') && (
          <div className="mb-8 w-full overflow-hidden bg-gradient-to-r from-cute-primary to-cute-secondary shadow-lg relative">
            <div className="py-3 md:py-4 relative">
              <div className="flex items-center text-white font-bold text-sm sm:text-base md:text-lg lg:text-xl whitespace-nowrap">
                <div 
                  className="flex items-center gap-4 sm:gap-6 md:gap-8"
                  style={{
                    animation: `scroll ${effectiveMarqueeDuration}s linear infinite`,
                    willChange: 'transform',
                    display: 'inline-flex',
                    width: 'max-content'
                  }}
                >
                  {/* 重複多次以確保無縫循環，覆蓋整個頁面寬度 */}
                  {[...Array(effectiveRepeatCount)].map((_, repeatIndex) => 
                    marqueeMessages.filter(msg => msg.trim() !== '').map((msg, i) => (
                      <span key={`${repeatIndex}-${i}`} className="inline-block px-3 sm:px-4 md:px-6 flex-shrink-0">{msg}</span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="px-4 max-w-7xl mx-auto">

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
        <div className="mb-6">
          <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm">
            <div className="flex flex-col gap-3">
              {/* 商品分類 - 可展開 */}
              <div>
                <button
                  onClick={() => setCategoryExpanded(!categoryExpanded)}
                  className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-pink-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-cute-primary to-cute-secondary rounded-full"></div>
                    <h3 className="text-sm font-semibold text-gray-700">商品分類</h3>
                    {selectedCategory !== '全部' && (
                      <span className="px-2 py-0.5 bg-cute-primary/20 text-cute-primary text-xs font-bold rounded-full">
                        {selectedCategory}
                      </span>
                    )}
                  </div>
                  {categoryExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {categoryExpanded && (
                  <div className="flex flex-wrap gap-2 mt-3 px-3">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
                          selectedCategory === category
                            ? 'bg-gradient-to-r from-cute-primary to-cute-secondary text-white shadow-md'
                            : 'bg-gray-50 text-gray-700 hover:bg-pink-50 border border-gray-200'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 排序方式 - 可展開 */}
              <div>
                <button
                  onClick={() => setSortExpanded(!sortExpanded)}
                  className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-pink-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-cute-secondary to-cute-primary rounded-full"></div>
                    <h3 className="text-sm font-semibold text-gray-700">排序方式</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
                      {sortBy === 'newest' ? '最新上架' : 
                       sortBy === 'price-asc' ? '價格：低到高' :
                       sortBy === 'price-desc' ? '價格：高到低' :
                       sortBy === 'name-asc' ? '名稱：A-Z' : '名稱：Z-A'}
                    </span>
                  </div>
                  {sortExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {sortExpanded && (
                  <div className="mt-3 px-3">
                    <label htmlFor="sort-select" className="sr-only">排序方式</label>
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full bg-white border-2 border-pink-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-cute-primary focus:border-cute-primary transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23FF90BC%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat"
                    >
                      <option value="newest">最新上架</option>
                      <option value="price-asc">價格：低到高</option>
                      <option value="price-desc">價格：高到低</option>
                      <option value="name-asc">名稱：A-Z</option>
                      <option value="name-desc">名稱：Z-A</option>
                    </select>
                  </div>
                )}
              </div>
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
        </div>
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
                <li>前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-cute-primary font-bold hover:underline">Firebase Console</a> 並建立一個新專案。</li>
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
              <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="關閉購物車">
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
                    <img src={(item.images && item.images.length > 0) ? item.images[0] : item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h4 className="text-gray-800 font-bold text-sm line-clamp-1">{item.name}</h4>
                      <p className="text-cute-primary font-bold text-sm">${item.price.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-red-50 rounded-full"
                      aria-label={`移除 ${item.name}`}
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
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md" 
            onClick={() => { 
              if(checkoutStep === 5) {
                setIsCheckoutOpen(false);
              } else if (checkoutStep !== 4) {
                if (window.confirm('確定要取消結帳嗎？')) {
                  setIsCheckoutOpen(false);
                  setCheckoutStep(1);
                }
              }
            }} 
          />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* 關閉按鈕 */}
            {checkoutStep !== 4 && checkoutStep !== 5 && (
              <button
                onClick={() => {
                  if (window.confirm('確定要取消結帳嗎？')) {
                    setIsCheckoutOpen(false);
                    setCheckoutStep(1);
                  }
                }}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors shadow-md"
                aria-label="取消"
              >
                <X size={20} />
              </button>
            )}
            
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
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 text-lg mb-4">購物車是空的</p>
                      <button 
                        onClick={() => setIsCheckoutOpen(false)}
                        className="text-cute-primary hover:underline font-bold"
                      >
                        繼續購物
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 mb-6">
                        {cart.map((item) => {
                          const checkoutQuantity = cartItemQuantities.get(item.id) || item.quantity;
                          const isSelected = selectedCartItems.has(item.id);
                          return (
                            <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 bg-gray-50 rounded-xl">
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <label className="sr-only" htmlFor={`checkout-select-${item.id}`}>選擇此商品進行結帳</label>
                                <input
                                  id={`checkout-select-${item.id}`}
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setSelectedCartItems(prev => {
                                      const newSet = new Set(prev);
                                      if (e.target.checked) {
                                        newSet.add(item.id);
                                        // 初始化數量為購物車中的數量
                                        setCartItemQuantities(prevQty => {
                                          const newMap = new Map(prevQty);
                                          if (!newMap.has(item.id)) {
                                            newMap.set(item.id, item.quantity);
                                          }
                                          return newMap;
                                        });
                                      } else {
                                        newSet.delete(item.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-6 h-6 text-cute-primary border-gray-300 rounded focus:ring-2 focus:ring-cute-primary cursor-pointer flex-shrink-0"
                                />
                                <img src={(item.images && item.images.length > 0) ? item.images[0] : item.image} alt={item.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-gray-800 truncate text-sm sm:text-base">{item.name}</h3>
                                  {!isSelected && (
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1">數量: {item.quantity} × ${item.price.toFixed(2)}</p>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pl-9 sm:pl-0">
                                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                                    <span className="text-xs font-semibold text-gray-600">結帳數量</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (checkoutQuantity > 1) {
                                            setCartItemQuantities(prev => {
                                              const newMap = new Map(prev);
                                              newMap.set(item.id, checkoutQuantity - 1);
                                              return newMap;
                                            });
                                          }
                                        }}
                                        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 rounded-lg flex items-center justify-center text-gray-700 font-bold text-base transition-colors touch-manipulation"
                                        disabled={checkoutQuantity <= 1}
                                      >
                                        -
                                      </button>
                                      <label className="sr-only" htmlFor={`checkout-qty-${item.id}`}>調整結帳數量</label>
                                      <input
                                        id={`checkout-qty-${item.id}`}
                                        type="number"
                                        min={1}
                                        max={item.quantity}
                                        value={checkoutQuantity}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const newQty = Math.max(1, Math.min(item.quantity, parseInt(e.target.value) || 1));
                                          setCartItemQuantities(prev => {
                                            const newMap = new Map(prev);
                                            newMap.set(item.id, newQty);
                                            return newMap;
                                          });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-16 text-center border-2 border-gray-300 rounded-lg px-2 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-cute-primary"
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (checkoutQuantity < item.quantity) {
                                            setCartItemQuantities(prev => {
                                              const newMap = new Map(prev);
                                              newMap.set(item.id, checkoutQuantity + 1);
                                              return newMap;
                                            });
                                          }
                                        }}
                                        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 rounded-lg flex items-center justify-center text-gray-700 font-bold text-base transition-colors touch-manipulation"
                                        disabled={checkoutQuantity >= item.quantity}
                                      >
                                        +
                                      </button>
                                      <span className="text-xs text-gray-400 ml-1">/ {item.quantity} 件</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end sm:items-start gap-1 ml-auto sm:ml-0">
                                    <span className="text-xs font-semibold text-gray-600">小計</span>
                                    <span className="font-bold text-lg sm:text-xl text-cute-primary whitespace-nowrap">
                                      ${(item.price * checkoutQuantity).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {!isSelected && (
                                <div className="flex flex-col items-end gap-1 ml-auto sm:ml-0 pl-9 sm:pl-0">
                                  <span className="text-xs font-semibold text-gray-600">小計</span>
                                  <span className="font-bold text-lg sm:text-xl text-gray-400 whitespace-nowrap">
                                    ${(item.price * item.quantity).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* 優惠券選擇 */}
                      {user && userCoupons.length > 0 && (
                        <div className="mb-6 p-4 bg-white border-2 border-pink-300 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                              <Ticket size={18} className="text-cute-primary" />
                              選擇優惠券
                            </span>
                            {selectedCoupon && (
                              <button
                                onClick={() => setSelectedCoupon(null)}
                                className="text-xs text-gray-500 hover:text-red-500"
                              >
                                取消選擇
                              </button>
                            )}
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {userCoupons
                              .filter((uc) => {
                                if (uc.isUsed) return false;
                                const now = new Date();
                                const validUntil = new Date(uc.coupon.validUntil);
                                return validUntil >= now;
                              })
                              .map((uc) => {
                                const { subtotal } = calculateTotal();
                                const canUse = !uc.coupon.minPurchaseAmount || subtotal >= uc.coupon.minPurchaseAmount;
                                return (
                                  <button
                                    key={uc.id}
                                    onClick={() => {
                                      if (canUse) {
                                        setSelectedCoupon(uc);
                                      } else {
                                        alert(`此優惠券需滿 $${uc.coupon.minPurchaseAmount} 才能使用`);
                                      }
                                    }}
                                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                      selectedCoupon?.id === uc.id
                                        ? 'border-cute-primary bg-pink-50'
                                        : canUse
                                        ? 'border-gray-300 hover:border-cute-primary'
                                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                                    }`}
                                    disabled={!canUse}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-bold text-gray-900">{uc.coupon.name}</div>
                                        <div className="text-xs text-gray-500">
                                          {uc.coupon.type === 'discount'
                                            ? `折扣 ${uc.coupon.discount}%`
                                            : uc.coupon.type === 'freeShipping'
                                            ? '免運'
                                            : `折抵 $${uc.coupon.fixedAmount}`}
                                          {uc.coupon.minPurchaseAmount > 0 &&
                                            ` • 滿 $${uc.coupon.minPurchaseAmount} 可用`}
                                        </div>
                                      </div>
                                      {selectedCoupon?.id === uc.id && (
                                        <CheckCircle2 size={20} className="text-cute-primary" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* 金額摘要 */}
                      <div className="p-6 border-2 border-pink-300 bg-white rounded-2xl mb-6 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-bold">小計</span>
                          <span className="text-xl font-black text-gray-900">
                            ${calculateTotal().subtotal.toFixed(2)}
                          </span>
                        </div>
                        {selectedCoupon && calculateTotal().discount > 0 && (
                          <div className="flex justify-between items-center text-green-600">
                            <span className="font-bold">優惠折扣</span>
                            <span className="text-xl font-black">-${calculateTotal().discount.toFixed(2)}</span>
                          </div>
                        )}
                        {selectedCoupon?.coupon.type === 'freeShipping' && (
                          <div className="flex justify-between items-center text-green-600">
                            <span className="font-bold">免運優惠</span>
                            <span className="text-xl font-black">-${calculateTotal().shipping.toFixed(2)}</span>
                          </div>
                        )}
                        {calculateTotal().shipping > 0 && (!selectedCoupon || selectedCoupon.coupon.type !== 'freeShipping') && (
                          <div className="flex justify-between items-center text-gray-600">
                            <span className="font-bold">運費</span>
                            <span className="text-xl font-black">${calculateTotal().shipping.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-3 border-t-2 border-gray-300 flex justify-between items-center">
                          <span className="text-gray-700 font-black text-lg">總金額（已選 {selectedCartItems.size} 項）</span>
                          <span className="text-4xl font-black text-cute-primary">
                            ${calculateTotal().total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedCartItems.size === 0) {
                            alert('請至少選擇一個商品進行結帳');
                            return;
                          }
                          setCheckoutStep(2);
                        }}
                        disabled={selectedCartItems.size === 0}
                        className="w-full bg-cute-primary text-white font-bold py-4 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一步：填寫收貨資訊
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Shipping Info */}
              {checkoutStep === 2 && (
                <div>
                  <h2 className="text-3xl font-black text-gray-800 mb-6">收貨資訊</h2>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label htmlFor="shipping-name" className="block text-sm font-bold text-gray-600 mb-2">收貨人姓名 *</label>
                      <input 
                        type="text" 
                        id="shipping-name"
                        value={shippingInfo.name}
                        onChange={(e) => setShippingInfo({...shippingInfo, name: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="shipping-phone" className="block text-sm font-bold text-gray-600 mb-2">聯絡電話 *</label>
                      <input 
                        type="tel" 
                        id="shipping-phone"
                        value={shippingInfo.phone}
                        onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipping-country" className="block text-sm font-bold text-gray-600 mb-2">國家/地區 *</label>
                        <input 
                          type="text" 
                          id="shipping-country"
                          value={shippingInfo.country}
                          onChange={(e) => setShippingInfo({...shippingInfo, country: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                          required
                        />
                    </div>
                      <div>
                        <label htmlFor="shipping-city" className="block text-sm font-bold text-gray-600 mb-2">縣市 *</label>
                        <input 
                          type="text" 
                          id="shipping-city"
                          value={shippingInfo.city}
                          onChange={(e) => setShippingInfo({...shippingInfo, city: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                          required
                        />
                  </div>
                    </div>
                    <div>
                      <label htmlFor="shipping-postal" className="block text-sm font-bold text-gray-600 mb-2">郵遞區號 *</label>
                      <input 
                        type="text" 
                        id="shipping-postal"
                        value={shippingInfo.postalCode}
                        onChange={(e) => setShippingInfo({...shippingInfo, postalCode: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-cute-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="shipping-address" className="block text-sm font-bold text-gray-600 mb-2">詳細地址 *</label>
                      <textarea 
                        id="shipping-address"
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
                  <div className="space-y-4 mb-4">
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
                  {user && (
                    <div className="mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={savePaymentAsDefault}
                          onChange={(e) => setSavePaymentAsDefault(e.target.checked)}
                          className="w-5 h-5 text-cute-primary border-gray-300 rounded focus:ring-cute-primary cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 font-medium">儲存此付款資訊為預設，下次結帳時自動填入</span>
                      </label>
                    </div>
                  )}
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