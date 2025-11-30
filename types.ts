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
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  birthday?: string;
  gender?: 'male' | 'female' | 'other';
  emergencyContact?: string;
  emergencyPhone?: string;
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
