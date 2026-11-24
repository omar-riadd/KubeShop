import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { ToastProvider } from '../ui/Toast';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CartDrawerProvider } from '../../context/CartDrawerContext';
import { CartDrawer } from '../cart/CartDrawer';
import { SearchProvider } from '../../context/SearchContext';
import { CommandPalette } from '../search/CommandPalette';

export const Layout: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const location = useLocation();

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Set title and focus heading on route change
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Shop · KubeShop',
      '/cart': 'Your Cart · KubeShop',
      '/checkout': 'Checkout · KubeShop',
      '/orders': 'Your Orders · KubeShop',
      '/status': 'Platform Status · KubeShop',
    };

    let title = titles[location.pathname];
    if (!title) {
      if (location.pathname.startsWith('/products/')) {
        title = 'Product Details · KubeShop';
      } else if (location.pathname.startsWith('/orders/')) {
        title = 'Order Confirmation · KubeShop';
      } else {
        title = 'Not Found · KubeShop';
      }
    }
    document.title = title;

    // Shift focus to main heading
    const h1 = document.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus();
    }
  }, [location.pathname]);

  return (
    <ToastProvider>
      <CartDrawerProvider>
        <SearchProvider>
          <div className="min-h-screen flex flex-col bg-bg text-text">
            {/* Skip Link */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-contrast focus:rounded-sm focus:shadow-lg focus:outline-2 focus:outline-primary-contrast font-medium text-sm"
            >
              Skip to content
            </a>

            {/* Offline Banner */}
            {!isOnline && (
              <div
                role="alert"
                className="bg-warning text-black px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2"
              >
                <WifiOff className="w-4 h-4" />
                <span>You are currently offline. Some features may not be available.</span>
              </div>
            )}

            <Header />

            <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
              <Suspense fallback={<LoadingSpinner />}>
                <Outlet />
              </Suspense>
            </main>

            <Footer />

            {/* Slide-out Cart Drawer */}
            <CartDrawer />

            {/* Global Command Palette Quick Search */}
            <CommandPalette />
          </div>
        </SearchProvider>
      </CartDrawerProvider>
    </ToastProvider>
  );
};
