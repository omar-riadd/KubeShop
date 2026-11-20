import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Sun, Moon, Laptop, Menu, X, Terminal } from 'lucide-react';
import { useCart } from '../../api/cart';
import { useRuntimeConfig } from '../../api/runtimeConfig';
import { getStoredTheme, setTheme, type Theme } from '../../lib/theme';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';

export const Header: React.FC = () => {
  const { data: cart } = useCart();
  const { data: runtimeConfig } = useRuntimeConfig();
  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme());
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const cycleTheme = () => {
    const next: Record<Theme, Theme> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    const newTheme = next[currentTheme];
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  const env = runtimeConfig?.environment || 'local';
  const showEnvBadge = env !== 'prod';
  const envVariants: Record<string, 'default' | 'warning' | 'primary'> = {
    local: 'default',
    dev: 'warning',
    staging: 'primary',
  };

  const navLinks = [
    { to: '/', label: 'Shop' },
    { to: '/status', label: 'Status' },
    { to: '/orders', label: 'Orders' },
  ];

  const itemCount = cart?.itemCount || 0;

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-text hover:text-primary transition-colors focus-visible:outline-offset-2"
          >
            <div className="w-8 h-8 rounded-sm bg-primary text-primary-contrast flex items-center justify-center font-mono font-black text-base shadow-xs">
              <Terminal className="w-5 h-5" />
            </div>
            <span>KubeShop</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active =
                link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                    active
                      ? 'bg-border/40 text-text font-semibold'
                      : 'text-text-muted hover:text-text hover:bg-border/20'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-3">
          {showEnvBadge && (
            <Badge
              variant={envVariants[env] || 'default'}
              className="uppercase font-mono text-[10px]"
            >
              {env}
            </Badge>
          )}

          {/* Theme toggle */}
          <IconButton
            label={`Theme: ${currentTheme}. Click to change`}
            size="sm"
            onClick={cycleTheme}
          >
            {currentTheme === 'light' && <Sun className="w-4 h-4" />}
            {currentTheme === 'dark' && <Moon className="w-4 h-4" />}
            {currentTheme === 'system' && <Laptop className="w-4 h-4" />}
          </IconButton>

          {/* Cart Icon */}
          <Link
            to="/cart"
            data-testid="cart-link"
            aria-label={`Shopping cart with ${itemCount} items`}
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-sm hover:bg-border/20 transition-colors text-text"
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-primary text-primary-contrast text-xs font-bold font-mono rounded-full ring-2 ring-surface"
              >
                {itemCount}
              </span>
            )}
            <span aria-live="polite" className="sr-only">
              {itemCount} items in cart
            </span>
          </Link>

          {/* Mobile menu button */}
          <IconButton
            label={menuOpen ? 'Close menu' : 'Open menu'}
            size="sm"
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </IconButton>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {menuOpen && (
        <nav
          className="md:hidden border-t border-border bg-surface px-4 py-3 flex flex-col gap-2"
          aria-label="Mobile Navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 text-sm font-medium rounded-sm text-text hover:bg-border/20"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};
