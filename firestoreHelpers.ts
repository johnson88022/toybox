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
  const { updatedAt, ...profileData } = profile;
  const docRef = doc(db, 'userProfiles', profile.userId);
  await setDoc(docRef, {
    ...profileData,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

// MARQUEE MESSAGES
export const getMarqueeMessages = async (): Promise<{ messages: string[]; speed: number }> => {
  const docRef = doc(db, 'settings', 'marquee');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const messages = data.messages || [];
    const speed = data.speed || 30;
    // 如果訊息陣列為空或所有訊息都是空的，返回空陣列
    if (messages.length === 0 || !messages.some((msg: string) => msg.trim() !== '')) {
      return { messages: [], speed };
    }
    return { messages, speed };
  }
  // 如果不存在，返回空陣列（不顯示預設內容）
  return { messages: [], speed: 30 };
};

export const updateMarqueeMessages = async (messages: string[], speed?: number) => {
  const docRef = doc(db, 'settings', 'marquee');
  const updateData: any = {
    messages: messages,
    updatedAt: serverTimestamp()
  };
  if (speed !== undefined) {
    updateData.speed = speed;
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

export const listenMarqueeMessages = (cb: (messages: string[], speed?: number) => void) => {
  const docRef = doc(db, 'settings', 'marquee');
  return onSnapshot(docRef, 
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const messages = data.messages || [];
        const speed = data.speed || 30;
        // 如果訊息陣列為空或所有訊息都是空的，返回空陣列
        if (messages.length === 0 || !messages.some((msg: string) => msg.trim() !== '')) {
          cb([], speed);
          return;
        }
        cb(messages, speed);
      } else {
        // 如果不存在，返回空陣列（不顯示預設內容）
        cb([], 30);
      }
    },
    (error) => {
      console.error('Firestore listenMarqueeMessages error:', error);
      cb([], 30);
    }
  );
};

// 圖片壓縮功能已移至 utils/imageCompress.ts
// 此處不再需要 Storage 上傳功能
