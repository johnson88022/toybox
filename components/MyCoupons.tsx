import React, { useState, useEffect } from 'react';
import { Ticket, Gift, Calendar, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { UserCoupon, Coupon } from '../types';
import { listenUserCoupons } from '../firestoreHelpers';

interface MyCouponsProps {
  userId: string;
}

const MyCoupons: React.FC<MyCouponsProps> = ({ userId }) => {
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [filter, setFilter] = useState<'all' | 'available' | 'used' | 'expired'>('all');

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = listenUserCoupons(userId, (coupons) => {
      setUserCoupons(coupons);
    });
    return () => unsubscribe();
  }, [userId]);

  const now = new Date();
  
  // 輔助函數：正確轉換日期
  const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue.toDate) return dateValue.toDate();
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    return null;
  };

  const availableCoupons = userCoupons.filter((uc) => {
    if (!uc || !uc.coupon) return false;
    if (uc.isUsed) return false;
    const validUntil = parseDate(uc.coupon.validUntil);
    if (!validUntil) return false;
    const validFrom = parseDate(uc.coupon.validFrom);
    // 檢查是否在有效期內
    return validUntil >= now && (!validFrom || validFrom <= now);
  });

  const usedCoupons = userCoupons.filter((uc) => uc.isUsed);
  const expiredCoupons = userCoupons.filter((uc) => {
    if (!uc || !uc.coupon) return false;
    if (uc.isUsed) return false;
    const validUntil = parseDate(uc.coupon.validUntil);
    if (!validUntil) return false;
    return validUntil < now;
  });

  const getFilteredCoupons = () => {
    switch (filter) {
      case 'available':
        return availableCoupons;
      case 'used':
        return usedCoupons;
      case 'expired':
        return expiredCoupons;
      default:
        return userCoupons;
    }
  };

  const getCouponColor = (coupon: Coupon) => {
    if (coupon.type === 'discount') return 'blue';
    if (coupon.type === 'freeShipping') return 'green';
    return 'purple';
  };

  const getCouponIcon = (coupon: Coupon) => {
    if (coupon.type === 'discount') return '🎫';
    if (coupon.type === 'freeShipping') return '🚚';
    return '💰';
  };

  const formatCouponValue = (coupon: Coupon) => {
    if (coupon.type === 'discount') {
      return `${coupon.discount}% OFF`;
    }
    if (coupon.type === 'freeShipping') {
      return '免運';
    }
    return `$${coupon.fixedAmount}`;
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-cute-bg">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl mb-4 shadow-sm border-2 border-pink-300">
            <Ticket className="w-8 h-8 text-cute-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-cute-text mb-3 tracking-tight">
            我的優惠券
          </h1>
          <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto font-medium">
            查看您擁有的優惠券，結帳時可選擇使用
          </p>
        </div>

        {/* 篩選標籤 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'all', label: '全部', count: userCoupons.length },
            { id: 'available', label: '可使用', count: availableCoupons.length },
            { id: 'used', label: '已使用', count: usedCoupons.length },
            { id: 'expired', label: '已過期', count: expiredCoupons.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                filter === tab.id
                  ? 'bg-cute-primary text-white shadow-lg'
                  : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-cute-primary hover:text-cute-primary'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  filter === tab.id ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 優惠券列表 */}
        {getFilteredCoupons().length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-gray-300 p-12 text-center">
            <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-bold">
              {filter === 'all'
                ? '您還沒有優惠券'
                : filter === 'available'
                ? '沒有可使用的優惠券'
                : filter === 'used'
                ? '沒有已使用的優惠券'
                : '沒有已過期的優惠券'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {filter === 'all' && '完成訂單或達成條件後即可獲得優惠券'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {getFilteredCoupons().map((userCoupon) => {
              const coupon = userCoupon.coupon;
              const color = getCouponColor(coupon);
              const icon = getCouponIcon(coupon);
              
              // 正確解析日期
              const parseDateForCheck = (dateValue: any): Date | null => {
                if (!dateValue) return null;
                if (dateValue instanceof Date) return dateValue;
                if (dateValue.toDate) return dateValue.toDate();
                if (typeof dateValue === 'string' || typeof dateValue === 'number') {
                  return new Date(dateValue);
                }
                return null;
              };
              
              const validUntilDate = parseDateForCheck(coupon.validUntil);
              const isExpired = !userCoupon.isUsed && validUntilDate !== null && validUntilDate < now;
              const isValid = !userCoupon.isUsed && !isExpired;

              return (
                <div
                  key={userCoupon.id}
                  className={`relative bg-white rounded-3xl border-2 ${
                    isValid
                      ? color === 'blue'
                        ? 'border-blue-500 shadow-lg hover:shadow-xl'
                        : color === 'green'
                        ? 'border-green-500 shadow-lg hover:shadow-xl'
                        : 'border-purple-500 shadow-lg hover:shadow-xl'
                      : 'border-gray-300 opacity-60'
                  } overflow-hidden transition-all`}
                >
                  {/* 優惠券背景裝飾 */}
                  <div
                    className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-20 ${
                      color === 'blue'
                        ? 'bg-blue-400'
                        : color === 'green'
                        ? 'bg-green-400'
                        : 'bg-purple-400'
                    }`}
                  />
                  <div
                    className={`absolute bottom-0 left-0 w-24 h-24 rounded-full -ml-12 -mb-12 opacity-10 ${
                      color === 'blue'
                        ? 'bg-blue-400'
                        : color === 'green'
                        ? 'bg-green-400'
                        : 'bg-purple-400'
                    }`}
                  />

                  <div className="relative p-6">
                    {/* 狀態標籤 */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{icon}</span>
                        <div>
                          <h3 className="text-xl font-black text-gray-900">{coupon.name}</h3>
                          {coupon.description && (
                            <p className="text-xs text-gray-500 mt-1">{coupon.description}</p>
                          )}
                        </div>
                      </div>
                      {userCoupon.isUsed ? (
                        <span className="px-3 py-1 bg-gray-500 text-white rounded-full text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          已使用
                        </span>
                      ) : isExpired ? (
                        <span className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold flex items-center gap-1">
                          <XCircle size={12} />
                          已過期
                        </span>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                            color === 'blue'
                              ? 'bg-blue-600'
                              : color === 'green'
                              ? 'bg-green-600'
                              : 'bg-purple-600'
                          }`}
                        >
                          可使用
                        </span>
                      )}
                    </div>

                    {/* 優惠內容 */}
                    <div
                      className={`p-4 rounded-2xl mb-4 ${
                        color === 'blue'
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : color === 'green'
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-purple-50 border-2 border-purple-200'
                      }`}
                    >
                      <div className="text-center">
                        <div
                          className={`text-4xl font-black mb-2 ${
                            color === 'blue'
                              ? 'text-blue-700'
                              : color === 'green'
                              ? 'text-green-700'
                              : 'text-purple-700'
                          }`}
                        >
                          {formatCouponValue(coupon)}
                        </div>
                        {coupon.minPurchaseAmount > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            滿 ${coupon.minPurchaseAmount} 可用
                          </p>
                        )}
                        {coupon.type === 'discount' && coupon.maxDiscountAmount > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            最高折抵 ${coupon.maxDiscountAmount}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 有效期 */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <Calendar size={14} />
                      <span>
                        有效期至 {(() => {
                          let validUntilDate: Date | null = null;
                          if (coupon.validUntil) {
                            if (coupon.validUntil instanceof Date) {
                              validUntilDate = coupon.validUntil;
                            } else if (coupon.validUntil.toDate) {
                              validUntilDate = coupon.validUntil.toDate();
                            } else {
                              validUntilDate = new Date(coupon.validUntil);
                            }
                          }
                          return validUntilDate ? validUntilDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未知';
                        })()}
                      </span>
                    </div>

                    {userCoupon.isUsed && userCoupon.usedAt && (
                      <div className="text-xs text-gray-400 mt-2">
                        使用時間：{new Date(userCoupon.usedAt).toLocaleString('zh-TW')}
                      </div>
                    )}

                    {/* 使用說明 */}
                    {isValid && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Sparkles size={12} />
                          結帳時可選擇使用此優惠券
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCoupons;

