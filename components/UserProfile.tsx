import React, { useState, useEffect } from 'react';
import { Save, X, User as UserIcon, Phone, MapPin, Mail, Calendar, Users } from 'lucide-react';
import { User as UserType, UserProfile as UserProfileType } from '../types';
import { getUserProfile, updateUserProfile } from '../firestoreHelpers';

interface UserProfileProps {
  user: UserType;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onClose }) => {
  const [profile, setProfile] = useState<Partial<UserProfileType>>({
    userId: user.id,
    name: user.name,
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '台灣',
    birthday: '',
    gender: undefined,
    emergencyContact: '',
    emergencyPhone: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user.id]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const existingProfile = await getUserProfile(user.id);
      if (existingProfile) {
        setProfile({
          ...existingProfile,
          name: existingProfile.name || user.name,
          email: existingProfile.email || user.email, // 確保 email 被載入
        });
      } else {
        // 初始化新的資料
        setProfile({
          userId: user.id,
          name: user.name,
          email: user.email, // 初始化時包含 email
          phone: '',
          address: '',
          city: '',
          postalCode: '',
          country: '台灣',
          birthday: '',
          gender: undefined,
          emergencyContact: '',
          emergencyPhone: '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      await updateUserProfile({
        ...profile,
        userId: user.id,
        name: profile.name || user.name,
        email: user.email, // 確保 email 被儲存
        updatedAt: new Date(),
      } as UserProfileType);
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('儲存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="w-12 h-12 border-4 border-cute-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 text-center">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-pink-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-cute-primary" />
            基本資料
          </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-pink-50 rounded-full transition-colors"
                aria-label="關閉"
              >
                <X size={24} />
              </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* 基本資訊 */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-cute-primary" />
              基本資訊
            </h3>
            
            <div>
              <label htmlFor="profile-name-input" className="block text-sm font-bold text-gray-600 mb-2">姓名 *</label>
              <input
                id="profile-name-input"
                type="text"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  電子郵件
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed"
                  aria-label="電子郵件"
                />
              </div>

              <div>
                <label htmlFor="profile-phone" className="block text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  電話 *
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-birthday-input" className="block text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  生日
                </label>
                <input
                  id="profile-birthday-input"
                  type="date"
                  value={profile.birthday || ''}
                  onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">性別</label>
                <select
                  value={profile.gender || ''}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value as any || undefined })}
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                  aria-label="性別"
                >
                  <option value="">請選擇</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>
          </div>

          {/* 聯絡地址 */}
          <div className="space-y-4 pt-4 border-t border-pink-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cute-primary" />
              聯絡地址
            </h3>

            <div>
              <label htmlFor="profile-country" className="block text-sm font-bold text-gray-600 mb-2">國家/地區 *</label>
              <input
                id="profile-country"
                type="text"
                value={profile.country || '台灣'}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="profile-city" className="block text-sm font-bold text-gray-600 mb-2">縣市 *</label>
              <input
                id="profile-city"
                type="text"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="例如：台北市"
                className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="profile-address" className="block text-sm font-bold text-gray-600 mb-2">詳細地址 *</label>
              <textarea
                id="profile-address"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="例如：信義區信義路五段7號"
                className="w-full h-20 bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary resize-none"
                required
              />
            </div>

            <div>
              <label htmlFor="profile-postal-code" className="block text-sm font-bold text-gray-600 mb-2">郵遞區號</label>
              <input
                id="profile-postal-code"
                type="text"
                value={profile.postalCode || ''}
                onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                placeholder="例如：110"
                className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
              />
            </div>
          </div>

          {/* 緊急聯絡人 */}
          <div className="space-y-4 pt-4 border-t border-pink-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-cute-primary" />
              緊急聯絡人
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-emergency-contact" className="block text-sm font-bold text-gray-600 mb-2">聯絡人姓名</label>
                <input
                  id="profile-emergency-contact"
                  type="text"
                  value={profile.emergencyContact || ''}
                  onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })}
                  placeholder="例如：張三"
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                />
              </div>

              <div>
                <label htmlFor="profile-emergency-phone" className="block text-sm font-bold text-gray-600 mb-2">聯絡人電話</label>
                <input
                  id="profile-emergency-phone"
                  type="tel"
                  value={profile.emergencyPhone || ''}
                  onChange={(e) => setProfile({ ...profile, emergencyPhone: e.target.value })}
                  placeholder="例如：0912345678"
                  className="w-full bg-gray-50 border border-pink-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-cute-primary"
                />
              </div>
            </div>
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-center font-bold">
              資料已成功儲存！
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-cute-primary text-white font-bold py-3 rounded-xl hover:bg-pink-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  儲存中...
                </>
              ) : (
                <>
                  <Save size={18} />
                  儲存資料
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfile;

