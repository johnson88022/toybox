import React, { useState } from 'react';
import { ArrowLeft, Package, CheckCircle2, Truck, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Order } from '../types';

interface MyOrdersProps {
  orders: Order[];
  user: { id: string };
  onUpdateOrderStatus: (orderId: string, status: 'pending' | 'shipped' | 'completed' | 'cancelled') => Promise<void>;
  onClose: () => void;
  onNavigateToProduct: (productId: string) => void;
}

const MyOrders: React.FC<MyOrdersProps> = ({ orders, user, onUpdateOrderStatus, onClose, onNavigateToProduct }) => {
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(false);
  const [isShippedCollapsed, setIsShippedCollapsed] = useState(false);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(false);
  const [isCancelledCollapsed, setIsCancelledCollapsed] = useState(false);

  const userOrders = orders.filter(o => o.userId === user.id);
  const pendingOrders = userOrders.filter(o => o.status === 'pending');
  const shippedOrders = userOrders.filter(o => o.status === 'shipped');
  const completedOrders = userOrders.filter(o => o.status === 'completed');
  const cancelledOrders = userOrders.filter(o => o.status === 'cancelled');

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('確定要取消此訂單嗎？取消後庫存會自動恢復。')) {
      return;
    }
    
    setCancellingOrderId(orderId);
    try {
      await onUpdateOrderStatus(orderId, 'cancelled');
      alert('訂單已取消！');
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert('取消訂單失敗，請重試');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const renderOrderCard = (order: Order, canCancel: boolean = false) => (
    <div key={order.id} className={`p-6 rounded-xl border-2 shadow-sm ${
      order.status === 'pending' ? 'bg-blue-50/50 border-blue-200' :
      order.status === 'shipped' ? 'bg-purple-50/50 border-purple-200' :
      order.status === 'completed' ? 'bg-green-50/50 border-green-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-bold text-gray-800 text-lg mb-1">訂單 #{order.id?.slice(-8) || 'N/A'}</div>
          <div className="text-sm text-gray-500">
            {order.date ? new Date(order.date.seconds ? order.date.seconds * 1000 : order.date).toLocaleString('zh-TW') : '日期未知'}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          order.status === 'shipped' ? 'bg-purple-100 text-purple-700' :
          order.status === 'completed' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {order.status === 'pending' ? '待處理' :
           order.status === 'shipped' ? '已出貨' :
           order.status === 'completed' ? '已完成' :
           '已取消'}
        </span>
      </div>
      
      {/* 商品列表 */}
      <div className="mb-4">
        <div className="font-bold text-gray-700 mb-2">商品內容：</div>
        <div className="space-y-2">
          {order.items?.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => onNavigateToProduct(item.id)}>
              <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1">
                <div className="font-bold text-gray-800">{item.name}</div>
                <div className="text-sm text-gray-500">數量: {item.quantity} × ${item.price?.toFixed(2) || '0.00'}</div>
              </div>
              <div className="font-bold text-cute-primary">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 收貨資訊 */}
      {order.shippingInfo && (
        <div className="mb-4 p-4 bg-white/60 rounded-lg border border-gray-200">
          <div className="font-bold text-gray-700 mb-2">收貨資訊：</div>
          <div className="space-y-1 text-sm text-gray-600">
            <div><span className="font-bold">收貨人：</span>{order.shippingInfo.name}</div>
            <div><span className="font-bold">電話：</span>{order.shippingInfo.phone}</div>
            <div><span className="font-bold">地址：</span>{order.shippingInfo.country} {order.shippingInfo.city} {order.shippingInfo.postalCode}</div>
            <div className="pl-12">{order.shippingInfo.address}</div>
          </div>
        </div>
      )}

      {/* 總金額和操作 */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <span className="text-2xl font-black text-cute-primary">${order.total?.toFixed(2) || '0.00'}</span>
        {canCancel && order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'shipped' && (
          <button
            onClick={() => handleCancelOrder(order.id)}
            disabled={cancellingOrderId === order.id}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancellingOrderId === order.id ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                取消中...
              </>
            ) : (
              <>
                <X size={18} /> 取消訂單
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-28 px-4 pb-12 bg-cute-bg">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={onClose}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          返回
        </button>

        <h1 className="text-4xl font-black text-gray-800 mb-8">我的訂單</h1>

        {/* 待處理訂單 */}
        {pendingOrders.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-lg overflow-hidden mb-6">
            <button
              onClick={() => setIsPendingCollapsed(!isPendingCollapsed)}
              className="w-full p-6 border-b-2 border-blue-200 bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  待處理訂單
                  <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-bold">
                    {pendingOrders.length}
                  </span>
                </h3>
                {isPendingCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-blue-600" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </button>
            {!isPendingCollapsed && (
              <div className="p-6 space-y-4">
                {pendingOrders.map(order => renderOrderCard(order, true))}
              </div>
            )}
          </div>
        )}

        {/* 已出貨訂單 */}
        {shippedOrders.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-purple-200 shadow-lg overflow-hidden mb-6">
            <button
              onClick={() => setIsShippedCollapsed(!isShippedCollapsed)}
              className="w-full p-6 border-b-2 border-purple-200 bg-gradient-to-r from-purple-100 to-purple-50 hover:from-purple-200 hover:to-purple-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-purple-700 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-purple-600" />
                  已出貨訂單
                  <span className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-bold">
                    {shippedOrders.length}
                  </span>
                </h3>
                {isShippedCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-purple-600" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-purple-600" />
                )}
              </div>
            </button>
            {!isShippedCollapsed && (
              <div className="p-6 space-y-4">
                {shippedOrders.map(order => renderOrderCard(order, false))}
              </div>
            )}
          </div>
        )}

        {/* 已完成訂單 */}
        {completedOrders.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-green-200 shadow-lg overflow-hidden mb-6">
            <button
              onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
              className="w-full p-6 border-b-2 border-green-200 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  已完成訂單
                  <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold">
                    {completedOrders.length}
                  </span>
                </h3>
                {isCompletedCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-green-600" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-green-600" />
                )}
              </div>
            </button>
            {!isCompletedCollapsed && (
              <div className="p-6 space-y-4">
                {completedOrders.map(order => renderOrderCard(order, false))}
              </div>
            )}
          </div>
        )}

        {/* 已取消訂單 */}
        {cancelledOrders.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-lg overflow-hidden mb-6">
            <button
              onClick={() => setIsCancelledCollapsed(!isCancelledCollapsed)}
              className="w-full p-6 border-b-2 border-gray-200 bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                  <X className="w-5 h-5 text-gray-600" />
                  已取消訂單
                  <span className="px-3 py-1 bg-gray-500 text-white rounded-full text-sm font-bold">
                    {cancelledOrders.length}
                  </span>
                </h3>
                {isCancelledCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                )}
              </div>
            </button>
            {!isCancelledCollapsed && (
              <div className="p-6 space-y-4">
                {cancelledOrders.map(order => renderOrderCard(order, false))}
              </div>
            )}
          </div>
        )}

        {userOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 text-xl font-medium">目前還沒有訂單</p>
            <button
              onClick={onClose}
              className="mt-6 bg-cute-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-pink-400 transition-colors"
            >
              開始購物
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
