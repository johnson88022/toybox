import React, { useState, useRef, useEffect } from 'react';
import { ShoppingCart, Sparkles, User as UserIcon, LayoutDashboard, Gift, Menu, X } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  user: User | null;
  onLoginClick: () => void;
  currentPage: string;
  onNavigate: (path: string) => void;
  onProfileClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onCartClick, user, onLoginClick, currentPage, onNavigate, onProfileClick }) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    if (accountMenuOpen) {
      window.addEventListener('mousedown', handler);
      return () => window.removeEventListener('mousedown', handler);
    }
  }, [accountMenuOpen]);

  const isActive = (path: string) => currentPage === path ? 'text-cute-primary bg-pink-50' : 'text-gray-500 hover:text-cute-primary hover:bg-pink-50/50';

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-pink-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center flex-1">
            <a href="#" onClick={handleNav('/')} className="flex-shrink-0 flex items-center gap-2 group">
              <div className="bg-cute-primary p-2 rounded-xl text-white transform group-hover:rotate-12 transition-transform">
                <Gift className="h-6 w-6" />
              </div>
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-cute-text group-hover:text-cute-primary transition-colors">
                Toy<span className="text-cute-primary">Box</span>
              </span>
            </a>
            
            {/* Desktop Menu */}
            <div className="hidden lg:flex ml-8 space-x-2 items-center">
              <a
                href="#"
                onClick={handleNav('/')}
                className={`${isActive('/')} px-4 py-2 rounded-full text-sm font-bold transition-all duration-300`}
              >
                商店
              </a>
              {/* 買家許願池：主動感更強的漸層膠囊按鈕 */}
              <a
                href="#"
                onClick={handleNav('/dream-factory')}
                className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 shadow-sm ${
                  currentPage === '/dream-factory'
                    ? 'bg-gradient-to-r from-cute-primary to-cute-secondary text-white shadow-pink-200/80 shadow-lg'
                    : 'bg-white text-cute-primary border border-pink-100 hover:bg-pink-50 hover:border-cute-primary/60'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                買家許願池
              </a>
              {/* 賣家後台：僅 Admin 顯示，改成更精緻的紫色 badge 風格 */}
              {user?.role === 'admin' && (
                <a
                  href="#"
                  onClick={handleNav('/admin')}
                  className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                    currentPage === '/admin'
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-200'
                      : 'bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  賣家後台
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-500 hover:text-cute-primary hover:bg-pink-50 rounded-full transition-all"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* 帳戶按鈕 */}
            <button
              ref={accountRef}
              onClick={user ? () => setAccountMenuOpen((v)=>!v) : onLoginClick}
              className="text-gray-500 hover:text-cute-primary px-2 sm:px-4 py-2 rounded-full text-sm font-bold transition-colors hover:bg-pink-50 relative flex items-center gap-2"
            >
              {user ? (
                <>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-cute-primary/20 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-cute-primary" />
                    </div>
                  )}
                  <span className="hidden sm:inline">{user.name}</span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="hidden sm:inline">登入</span>
                </>
              )}
              {/* 展開帳戶選單 */}
              {user && accountMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-lg bg-white border border-pink-100 z-50 p-2 flex flex-col">
                  {onProfileClick && (
                    <>
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onProfileClick();
                        }}
                        className="w-full text-left py-2 px-4 rounded-lg hover:bg-pink-50 text-gray-800 font-bold transition-colors"
                      >
                        基本資料
                      </button>
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onNavigate('/my-orders');
                        }}
                        className="w-full text-left py-2 px-4 rounded-lg hover:bg-pink-50 text-gray-800 font-bold transition-colors"
                      >
                        我的訂單
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onLoginClick();
                    }}
                    className="w-full text-left py-2 px-4 rounded-lg hover:bg-pink-50 text-gray-800 font-bold transition-colors"
                  >
                    登出
                  </button>
                </div>
              )}
            </button>
            {/* 購物車 */}
            <button 
              onClick={onCartClick}
              className="relative p-2 sm:p-3 text-gray-500 hover:text-cute-primary hover:bg-pink-50 rounded-full transition-all"
            >
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-xs font-bold leading-none text-white transform bg-cute-primary rounded-full shadow-md animate-bounce">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="lg:hidden border-t border-pink-100 bg-white py-4 space-y-2">
                <a 
                  href="#" 
                  onClick={handleNav('/')} 
                  className={`${isActive('/')} block px-4 py-3 rounded-xl text-base font-bold transition-all duration-300`}
                >
                  商店
                </a>
                {/* Mobile 買家許願池：漸層背景更突出 */}
                <a 
                  href="#" 
                  onClick={handleNav('/dream-factory')} 
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-base font-bold transition-all duration-300 ${
                    currentPage === '/dream-factory'
                      ? 'bg-gradient-to-r from-cute-primary to-cute-secondary text-white shadow-md'
                      : 'bg-white text-cute-primary border border-pink-100 hover:bg-pink-50'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  買家許願池
                </a>
                {/* Mobile 賣家後台：柔和紫色按鈕 */}
                {user?.role === 'admin' && (
                  <a 
                    href="#" 
                    onClick={handleNav('/admin')} 
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-base font-bold transition-all duration-300 ${
                      currentPage === '/admin'
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                        : 'bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    賣家後台
                  </a>
                )}
                {!user && (
                  <button
                    onClick={() => {
                      onLoginClick();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl text-base font-bold text-gray-500 hover:text-cute-primary hover:bg-pink-50 transition-all"
                  >
                    登入
                  </button>
                )}
              </div>
            )}
      </div>
    </nav>
  );
};

export default Navbar;