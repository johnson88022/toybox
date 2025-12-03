import { db } from './firebaseConfig';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, runTransaction, serverTimestamp, orderBy, Timestamp, where, getDoc, setDoc
} from 'firebase/firestore';

// PRODUCTS
export const listenProducts = (cb: (products: any[]) => void) => {
  // 直接使用無排序查詢，在客戶端排序（避免索引問題）
  const q = query(collection(db, 'products'));
  return onSnapshot(q, 
    (snapshot) => {
      const products = snapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        let createdAtTime = 0;
        
        // 處理 Firestore Timestamp
        if (createdAt) {
          if (createdAt.seconds) {
            createdAtTime = createdAt.seconds * 1000;
          } else if (createdAt.toMillis) {
            createdAtTime = createdAt.toMillis();
          } else if (createdAt.toDate) {
            createdAtTime = createdAt.toDate().getTime();
          } else if (createdAt instanceof Date) {
            createdAtTime = createdAt.getTime();
          }
        }
        
        return { 
          id: doc.id, 
          ...data,
          // 確保所有必要欄位都存在
          name: data.name || '',
          price: Number(data.price) || 0,
          description: data.description || '',
          category: data.category || 'Custom',
          image: data.image || 'https://via.placeholder.com/400',
          stock: Number(data.stock) ?? 0,
          rating: Number(data.rating) || 5.0,
          isNew: data.isNew !== undefined ? data.isNew : (createdAtTime > 0),
          _createdAtTime: createdAtTime || Date.now() // 用於排序
        };
      });
      
      // 在客戶端排序：新商品在前（按時間降序），然後按 isNew，最後按名稱
      products.sort((a: any, b: any) => {
        // 優先按創建時間（新商品在前）
        if (a._createdAtTime && b._createdAtTime) {
          return b._createdAtTime - a._createdAtTime;
        }
        // 其次按 isNew
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        // 最後按名稱
        return (a.name || '').localeCompare(b.name || '');
      });
      
      console.log('Products loaded:', products.length, 'Newest:', products[0]?.name);
      cb(products);
    },
    (error) => {
      console.error('Firestore listenProducts error:', error);
      cb([]);
    }
  );
};
export const addProduct = async (product: any) => {
  const { id, ...productData } = product;
  const dataToAdd = {
    name: (productData.name || '').trim(),
    price: Number(productData.price) || 0,
    description: (productData.description || '').trim(),
    category: productData.category || 'Custom',
    image: productData.image || 'https://via.placeholder.com/400',
    stock: Number(productData.stock) ?? 0,
    rating: Number(productData.rating) || 5.0,
    isNew: productData.isNew !== undefined ? productData.isNew : true,
    createdAt: serverTimestamp()
  };
  console.log('Adding product to Firestore:', dataToAdd);
  const docRef = await addDoc(collection(db, 'products'), dataToAdd);
  console.log('Product added successfully with ID:', docRef.id);
  return docRef.id;
};
export const updateProduct = async (id: string, updates: any) => {
  const { id: _, createdAt, ...updateData } = updates;
  
  // 過濾掉 undefined 值，Firestore 不接受 undefined
  const cleanUpdateData: any = {};
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      cleanUpdateData[key] = updateData[key];
    }
  });
  
  // 確保必要欄位都是正確類型
  const finalUpdateData = {
    ...cleanUpdateData,
    name: cleanUpdateData.name || '',
    price: Number(cleanUpdateData.price) || 0,
    description: cleanUpdateData.description || '',
    category: cleanUpdateData.category || 'Custom',
    image: cleanUpdateData.image || 'https://via.placeholder.com/400',
    stock: Number(cleanUpdateData.stock) ?? 0,
    rating: Number(cleanUpdateData.rating) || 5.0,
  };
  
  // 如果 images 是空陣列或只有一張圖片，移除 images 欄位（使用主圖即可）
  if (finalUpdateData.images && Array.isArray(finalUpdateData.images) && finalUpdateData.images.length <= 1) {
    delete finalUpdateData.images;
  }
  
  await updateDoc(doc(db, 'products', id), finalUpdateData);
};
export const deleteProduct = async (id: string) => {
  await deleteDoc(doc(db, 'products', id));
  console.log('Product deleted:', id);
};
export const updateOrderStatus = async (orderId: string, status: 'pending' | 'shipped' | 'completed' | 'cancelled') => {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error('Order not found');
  }
  
  const orderData = orderSnap.data();
  
  // 如果是取消訂單，需要恢復庫存
  if (status === 'cancelled' && orderData.status !== 'cancelled') {
    await runTransaction(db, async (transaction) => {
      for (const item of orderData.items || []) {
        const productRef = doc(db, 'products', item.id);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const currStock = productSnap.data().stock || 0;
          transaction.update(productRef, { stock: currStock + (item.quantity || 0) });
        }
      }
    });
  }
  
  await updateDoc(orderRef, {
    status: status
  });
  console.log('Order status updated:', orderId, status);
};
export const initializeProducts = async (products: any[]) => {
  const snapshot = await getDocs(collection(db, 'products'));
  if (snapshot.empty) {
    console.log('Initializing products in Firestore...');
    for (const product of products) {
      const { id, ...productData } = product;
      await addDoc(collection(db, 'products'), {
        ...productData,
        createdAt: serverTimestamp()
      });
  }
  }
};

// 重置所有資料
export const resetAllData = async () => {
  // 刪除所有 products
  const productsSnapshot = await getDocs(collection(db, 'products'));
  for (const docSnap of productsSnapshot.docs) {
    await deleteDoc(doc(db, 'products', docSnap.id));
  }
  
  // 刪除所有 wishes
  const wishesSnapshot = await getDocs(collection(db, 'wishes'));
  for (const docSnap of wishesSnapshot.docs) {
    await deleteDoc(doc(db, 'wishes', docSnap.id));
  }
  
  // 刪除所有 orders
  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  for (const docSnap of ordersSnapshot.docs) {
    await deleteDoc(doc(db, 'orders', docSnap.id));
  }
  
  // 不再重新初始化商品，讓賣家自行新增
};

// WISHES
export const listenWishes = (cb: (wishes: any[]) => void) => {
  const q = query(collection(db, 'wishes'), orderBy('created', 'desc'));
  return onSnapshot(q, 
    (snapshot) => {
      const wishes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      cb(wishes);
    },
    (error) => {
      console.error('Firestore listenWishes error:', error);
    }
  );
};
export const addWish = async (wish: string) => {
  await addDoc(collection(db, 'wishes'), { 
    text: wish, 
    created: serverTimestamp() 
  });
};

export const deleteWish = async (wishId: string) => {
  await deleteDoc(doc(db, 'wishes', wishId));
  console.log('Wish deleted:', wishId);
};

// ORDERS
export const addOrderAndUpdateStock = async (order: any, cart: any[]) => {
  // 修正：Firestore transactions 要求所有讀取在寫入之前完成
  await runTransaction(db, async (transaction) => {
    // 第一步：合併相同商品的數量（避免重複讀取和更新）
    const productQuantities = new Map<string, number>();
    const productNames = new Map<string, string>();
    for (const item of cart) {
      const existingQty = productQuantities.get(item.id) || 0;
      productQuantities.set(item.id, existingQty + item.quantity);
      if (!productNames.has(item.id)) {
        productNames.set(item.id, item.name);
      }
    }
    
    // 第二步：讀取所有需要更新的商品文檔（去重後）
    const uniqueProductIds = Array.from(productQuantities.keys());
    const productRefs = uniqueProductIds.map(id => doc(db, 'products', id));
    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    
    // 第三步：驗證庫存並準備更新
    const updates: Array<{ ref: any; newStock: number }> = [];
    for (let i = 0; i < uniqueProductIds.length; i++) {
      const productId = uniqueProductIds[i];
      const totalQuantity = productQuantities.get(productId) || 0;
      const snap = productSnaps[i];
      if (snap.exists()) {
        const currStock = snap.data().stock || 0;
        if (currStock < totalQuantity) {
          const productName = productNames.get(productId) || '商品';
          throw new Error(`商品「${productName}」庫存不足！目前僅剩 ${currStock} 件，您選擇了 ${totalQuantity} 件。`);
        }
        updates.push({
          ref: productRefs[i],
          newStock: Math.max(0, currStock - totalQuantity)
        });
      }
    }
    
    // 第四步：執行所有更新
    for (const update of updates) {
      transaction.update(update.ref, { stock: update.newStock });
    }
  });
  
  // Transaction 完成後建立訂單
  const { id, date, ...orderData } = order;
  await addDoc(collection(db, 'orders'), {
    ...orderData,
    date: serverTimestamp(),
    status: order.status || 'pending'
  });
};
export const listenOrders = (cb: (orders: any[]) => void) => {
  const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
  return onSnapshot(q, 
    (snapshot) => {
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
        };
      });
      cb(orders);
    },
    (error) => {
      console.error('Firestore listenOrders error:', error);
    }
  );
};

// USER PROFILES
export const getUserProfile = async (userId: string): Promise<any> => {
  const docRef = doc(db, 'userProfiles', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      ...data,
      name: data.name || '',
      phone: data.phone || '',
      address: data.address || '',
      city: data.city || '',
      postalCode: data.postalCode || '',
      country: data.country || '台灣',
      birthday: data.birthday || '',
      gender: data.gender || undefined,
      emergencyContact: data.emergencyContact || '',
      emergencyPhone: data.emergencyPhone || '',
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined)
    };
  }
  return null;
};

export const updateUserProfile = async (profile: any) => {
  const { updatedAt, lastLoginTime, ...profileData } = profile;
  const updateData: any = {
    ...profileData,
    updatedAt: serverTimestamp()
  };
  // 如果有 lastLoginTime，也記錄它
  if (lastLoginTime) {
    updateData.lastLoginTime = lastLoginTime instanceof Date ? lastLoginTime : serverTimestamp();
  }
  const docRef = doc(db, 'userProfiles', profile.userId);
  // 使用 setDoc 而不是 updateDoc，確保即使文檔不存在也能創建
  // merge: true 確保不會覆蓋現有欄位
  await setDoc(docRef, updateData, { merge: true });
  console.log('UserProfile updated in Firestore:', profile.userId, updateData);
};

export const getAllUserProfiles = async (): Promise<any[]> => {
  const usersSnap = await getDocs(collection(db, 'userProfiles'));
  return usersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      userId: doc.id,
      ...data,
      email: data.email || '', // 確保 email 欄位存在
      lastLoginTime: data.lastLoginTime?.toDate ? data.lastLoginTime.toDate() : (data.lastLoginTime ? new Date(data.lastLoginTime) : undefined),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined)
    };
  });
};

// MARQUEE MESSAGES
export const getMarqueeMessages = async (): Promise<{ messages: string[]; speed: number; repeatCount: number }> => {
  const docRef = doc(db, 'settings', 'marquee');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const messages = data.messages || [];
    const speed = data.speed || 30;
    const repeatCount = data.repeatCount || 8;
    // 如果訊息陣列為空或所有訊息都是空的，返回空陣列
    if (messages.length === 0 || !messages.some((msg: string) => msg.trim() !== '')) {
      return { messages: [], speed, repeatCount };
    }
    return { messages, speed, repeatCount };
  }
  // 如果不存在，返回空陣列（不顯示預設內容）
  return { messages: [], speed: 30, repeatCount: 8 };
};

export const updateMarqueeMessages = async (messages: string[], speed?: number, repeatCount?: number) => {
  const docRef = doc(db, 'settings', 'marquee');
  const updateData: any = {
    messages: messages,
    updatedAt: serverTimestamp()
  };
  if (speed !== undefined) {
    updateData.speed = speed;
  }
  if (repeatCount !== undefined) {
    updateData.repeatCount = repeatCount;
  }
  await setDoc(docRef, updateData, { merge: true });
};

export const getMarqueeSpeed = async (): Promise<number> => {
  const docRef = doc(db, 'settings', 'marquee');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.speed || 30; // 預設30秒
  }
  return 30;
};

export const listenMarqueeMessages = (cb: (messages: string[], speed?: number, repeatCount?: number) => void) => {
  const docRef = doc(db, 'settings', 'marquee');
  return onSnapshot(docRef, 
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const messages = data.messages || [];
        const speed = data.speed || 30;
        const repeatCount = data.repeatCount || 8;
        // 如果訊息陣列為空或所有訊息都是空的，返回空陣列
        if (messages.length === 0 || !messages.some((msg: string) => msg.trim() !== '')) {
          cb([], speed);
          return;
        }
        cb(messages, speed, repeatCount);
      } else {
        // 如果不存在，返回空陣列（不顯示預設內容）
        cb([], 30, 8);
      }
    },
    (error) => {
      console.error('Firestore listenMarqueeMessages error:', error);
      cb([], 30, 8);
    }
  );
};

// 圖片壓縮功能已移至 utils/imageCompress.ts
// 此處不再需要 Storage 上傳功能

// COUPONS
export const listenCoupons = (cb: (coupons: any[]) => void) => {
  const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, 
    (snapshot) => {
      const coupons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        validFrom: doc.data().validFrom?.toDate?.() || doc.data().validFrom,
        validUntil: doc.data().validUntil?.toDate?.() || doc.data().validUntil,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
      cb(coupons);
    },
    (error) => {
      console.error('Firestore listenCoupons error:', error);
      cb([]);
    }
  );
};

export const addCoupon = async (coupon: any) => {
  const docRef = await addDoc(collection(db, 'coupons'), {
    ...coupon,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateCoupon = async (couponId: string, updates: any) => {
  // 過濾掉 undefined 值，Firestore 不接受 undefined
  const cleanUpdates: any = {};
  for (const key in updates) {
    if (updates[key] !== undefined) {
      if (typeof updates[key] === 'object' && updates[key] !== null && !(updates[key] instanceof Date) && !(updates[key] instanceof Timestamp)) {
        // 遞歸處理嵌套對象
        const cleanNested: any = {};
        let hasValidFields = false;
        for (const nestedKey in updates[key]) {
          if (updates[key][nestedKey] !== undefined) {
            cleanNested[nestedKey] = updates[key][nestedKey];
            hasValidFields = true;
          }
        }
        if (hasValidFields) {
          cleanUpdates[key] = cleanNested;
        }
      } else {
        cleanUpdates[key] = updates[key];
      }
    }
  }
  await updateDoc(doc(db, 'coupons', couponId), cleanUpdates);
};

export const deleteCoupon = async (couponId: string) => {
  await deleteDoc(doc(db, 'coupons', couponId));
};

// USER COUPONS
export const listenUserCoupons = (userId: string, cb: (userCoupons: any[]) => void) => {
  // 如果沒有 userId，直接返回空數組
  if (!userId) {
    cb([]);
    return () => {};
  }
  
  // 嘗試使用 orderBy，如果失敗則不使用排序
  let q;
  try {
    q = query(
      collection(db, 'userCoupons'),
      where('userId', '==', userId),
      orderBy('obtainedAt', 'desc')
    );
  } catch (error) {
    // 如果索引不存在，只使用 where 查詢
    console.warn('Firestore index may not exist, using query without orderBy:', error);
    q = query(
      collection(db, 'userCoupons'),
      where('userId', '==', userId)
    );
  }
  
  return onSnapshot(q,
    (snapshot) => {
      const userCoupons = snapshot.docs.map(doc => {
        const data = doc.data();
        const couponData = data.coupon || {};
        
        // 確保 coupon 的日期字段正確轉換
        let couponValidFrom = null;
        let couponValidUntil = null;
        
        if (couponData.validFrom) {
          if (couponData.validFrom.toDate) {
            couponValidFrom = couponData.validFrom.toDate();
          } else if (couponData.validFrom instanceof Date) {
            couponValidFrom = couponData.validFrom;
          } else {
            couponValidFrom = new Date(couponData.validFrom);
          }
        }
        
        if (couponData.validUntil) {
          if (couponData.validUntil.toDate) {
            couponValidUntil = couponData.validUntil.toDate();
          } else if (couponData.validUntil instanceof Date) {
            couponValidUntil = couponData.validUntil;
          } else {
            couponValidUntil = new Date(couponData.validUntil);
          }
        }
        
        return {
          id: doc.id,
          ...data,
          obtainedAt: data.obtainedAt?.toDate?.() || data.obtainedAt,
          usedAt: data.usedAt?.toDate?.() || data.usedAt,
          // 確保 coupon 欄位存在且日期正確轉換
          coupon: {
            ...couponData,
            validFrom: couponValidFrom,
            validUntil: couponValidUntil,
          },
        };
      });
      // 如果沒有使用 orderBy，在客戶端排序
      if (!userCoupons[0]?.obtainedAt || userCoupons.length <= 1) {
        userCoupons.sort((a, b) => {
          const aTime = a.obtainedAt ? new Date(a.obtainedAt).getTime() : 0;
          const bTime = b.obtainedAt ? new Date(b.obtainedAt).getTime() : 0;
          return bTime - aTime;
        });
      }
      cb(userCoupons);
    },
    (error) => {
      console.error('Firestore listenUserCoupons error:', error);
      // 如果 orderBy 失敗，嘗試不使用排序
      if (error.code === 'failed-precondition') {
        const simpleQ = query(
          collection(db, 'userCoupons'),
          where('userId', '==', userId)
        );
        return onSnapshot(simpleQ,
          (snapshot) => {
            const userCoupons = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                obtainedAt: data.obtainedAt?.toDate?.() || data.obtainedAt,
                usedAt: data.usedAt?.toDate?.() || data.usedAt,
                coupon: data.coupon || {},
              };
            });
            // 客戶端排序
            userCoupons.sort((a, b) => {
              const aTime = a.obtainedAt ? new Date(a.obtainedAt).getTime() : 0;
              const bTime = b.obtainedAt ? new Date(b.obtainedAt).getTime() : 0;
              return bTime - aTime;
            });
            cb(userCoupons);
          },
          (err) => {
            console.error('Firestore listenUserCoupons fallback error:', err);
            cb([]);
          }
        );
      }
      cb([]);
    }
  );
};

export const grantCouponToUser = async (userId: string, couponId: string, coupon: any) => {
  // 檢查用戶是否已經擁有此優惠券且未使用
  const existingQuery = query(
    collection(db, 'userCoupons'),
    where('userId', '==', userId),
    where('couponId', '==', couponId),
    where('isUsed', '==', false)
  );
  const existingSnap = await getDocs(existingQuery);
  
  if (!existingSnap.empty) {
    // 改為返回 false 而不是 throw，讓調用方可以繼續處理其他優惠券
    console.log(`ℹ️ User ${userId} already has unused coupon ${couponId}, skipping grant`);
    return false;
  }

  // 確保 validFrom 和 validUntil 正確轉換為 Timestamp
  let validFrom: Timestamp;
  let validUntil: Timestamp;
  
  if (coupon.validFrom) {
    if (coupon.validFrom instanceof Date) {
      validFrom = Timestamp.fromDate(coupon.validFrom);
    } else if (typeof coupon.validFrom === 'string') {
      // 處理 YYYY-MM-DD 格式
      const date = new Date(coupon.validFrom);
      validFrom = Timestamp.fromDate(date);
    } else if (coupon.validFrom.toDate) {
      // 已經是 Timestamp
      validFrom = coupon.validFrom;
    } else {
      validFrom = Timestamp.fromDate(new Date(coupon.validFrom));
    }
  } else {
    validFrom = Timestamp.fromDate(new Date());
  }

  if (coupon.validUntil) {
    if (coupon.validUntil instanceof Date) {
      validUntil = Timestamp.fromDate(coupon.validUntil);
    } else if (typeof coupon.validUntil === 'string') {
      // 處理 YYYY-MM-DD 格式，設置為當天結束時間
      const date = new Date(coupon.validUntil + 'T23:59:59');
      validUntil = Timestamp.fromDate(date);
    } else if (coupon.validUntil.toDate) {
      // 已經是 Timestamp
      validUntil = coupon.validUntil;
    } else {
      validUntil = Timestamp.fromDate(new Date(coupon.validUntil));
    }
  } else {
    // 如果沒有設置，默認30天後過期
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    validUntil = Timestamp.fromDate(defaultExpiry);
  }

  // 構建完整的 coupon 對象，確保所有字段都正確
  const couponData = {
    ...coupon,
    validFrom,
    validUntil,
    // 確保日期字段被正確處理
    createdAt: coupon.createdAt ? (coupon.createdAt.toDate ? coupon.createdAt : Timestamp.fromDate(new Date(coupon.createdAt))) : serverTimestamp(),
  };

  await addDoc(collection(db, 'userCoupons'), {
    userId,
    couponId,
    coupon: couponData, // 保存完整的 coupon 對象，包含正確的日期
    obtainedAt: serverTimestamp(),
    isUsed: false,
  });
  
  console.log(`✅ Successfully granted coupon ${couponId} to user ${userId}`);
  return true;
};

export const useCoupon = async (userCouponId: string, orderId: string) => {
  await updateDoc(doc(db, 'userCoupons', userCouponId), {
    isUsed: true,
    usedAt: serverTimestamp(),
    orderId,
  });
};

// 獲取所有用戶的優惠券（用於檢查自動發放條件）
export const getUserOrders = async (userId: string) => {
  const q = query(
    collection(db, 'orders'),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate?.() || doc.data().date,
  }));
};
