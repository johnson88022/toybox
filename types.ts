export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string; // 支援自定義類別
  image: string;
  images?: string[]; // 多張商品圖片
  stock: number;
  rating: number;
  isNew?: boolean;
  imageFit?: 'cover' | 'contain'; // 圖片顯示方式：cover=填滿（可能裁切），contain=完整顯示
  createdAt?: Date | any; // 創建時間，用於排序
  specifications?: { [key: string]: string }; // 商品規格，例如：尺寸、材質等
  reviews?: Review[]; // 商品評價
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: Date;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'customer' | 'admin';
}

export interface UserProfile {
  userId: string;
  name: string;
  email?: string; // 新增 email 欄位
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  birthday?: string;
  gender?: 'male' | 'female' | 'other';
  emergencyContact?: string;
  emergencyPhone?: string;
  lastLoginTime?: Date; // 新增登入時間欄位
  updatedAt?: Date;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface PaymentInfo {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  date: Date;
  status: 'pending' | 'shipped' | 'completed' | 'cancelled';
  shippingInfo?: ShippingInfo;
  paymentInfo?: PaymentInfo;
  couponId?: string; // 使用的優惠券 ID
  discountAmount?: number; // 優惠金額
}

// 優惠券類型
export type CouponType = 'discount' | 'freeShipping' | 'fixedAmount';

// 自動發放條件類型
export type AutoGrantConditionType = 
  | 'firstOrder' // 首次下單
  | 'orderAmount' // 訂單金額達到
  | 'orderCount' // 訂單數量達到
  | 'birthday' // 生日當月
  | 'register' // 註冊會員
  | 'totalSpent'; // 累積消費達到

// 自動發放條件
export interface AutoGrantCondition {
  type: AutoGrantConditionType;
  value?: number; // 用於 orderAmount, orderCount, totalSpent
  enabled: boolean;
}

// 優惠券
export interface Coupon {
  id: string;
  name: string; // 優惠券名稱
  description?: string; // 描述
  type: CouponType; // 類型
  discount?: number; // 折扣百分比（discount 類型用）
  fixedAmount?: number; // 固定金額（fixedAmount 類型用）
  minPurchaseAmount?: number; // 最低消費金額
  maxDiscountAmount?: number; // 最高折扣金額（discount 類型用）
  validFrom: Date | any; // 有效開始日期
  validUntil: Date | any; // 有效結束日期
  usageLimit?: number; // 總使用次數限制
  userUsageLimit?: number; // 每個用戶使用次數限制（預設 1）
  targetUsers?: string[]; // 指定用戶 ID 列表（空則表示所有用戶）
  autoGrant?: AutoGrantCondition; // 自動發放條件
  createdAt: Date | any;
  isActive: boolean; // 是否啟用
}

// 用戶擁有的優惠券
export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  coupon: Coupon; // 優惠券詳細資訊
  obtainedAt: Date | any; // 獲得時間
  usedAt?: Date | any; // 使用時間
  isUsed: boolean; // 是否已使用
  orderId?: string; // 使用的訂單 ID
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export type ImageSize = '1K' | '2K' | '4K';

export interface GeneratedImage {
  url: string;
  prompt: string;
  size: ImageSize;
  createdAt: Date;
}
