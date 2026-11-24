import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, CornerDownLeft, Sparkles, AlertCircle } from 'lucide-react';
import { useProducts } from '../../api/catalog';
import { Money } from '../ui/Money';
import { Badge } from '../ui/Badge';

import { useSearch } from '../../context/SearchContext';

interface CommandPaletteProps {
  open?: boolean;
  onClose?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open: controlledOpen,
  onClose: controlledOnClose,
}) => {
  const searchCtx = useSearch();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : searchCtx.isOpen;

  const handleClose = () => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      searchCtx.closeSearch();
    }
    setQuery('');
    setActiveIndex(0);
  };

  const { data: productsData } = useProducts({ limit: 50 });
  const allProducts = useMemo(() => productsData?.items || [], [productsData]);

  // Global keyboard shortcut listener for Cmd+K / Ctrl+K and '/'
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash =
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);

      if (isCmdK || isSlash) {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          if (isControlled) {
            controlledOnClose?.();
          } else {
            searchCtx.openSearch();
          }
        }
      }

      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isControlled, controlledOnClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Filter products by search query and category
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (!query.trim()) return list;

    const lower = query.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.category.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
    );
  }, [allProducts, query, selectedCategory]);

  // Reset active index when search results change
  useEffect(() => {
    setActiveIndex(0);
  }, [filteredProducts]);

  // Keyboard navigation within the results list
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < filteredProducts.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredProducts.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredProducts[activeIndex];
      if (target) {
        handleSelectProduct(target.id);
      }
    }
  };

  const handleSelectProduct = (productId: string) => {
    handleClose();
    navigate(`/products/${productId}`);
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Products' },
    { id: 'keyboards', label: 'Keyboards' },
    { id: 'mice', label: 'Mice' },
    { id: 'audio', label: 'Audio' },
    { id: 'accessories', label: 'Accessories' },
  ];

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Product Search Command Palette"
        className="w-full max-w-2xl bg-surface text-text border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-border bg-surface">
          <Search className="w-5 h-5 text-text-muted shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            placeholder="Search Kubernetes hardware, nodes, keycaps, switches..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent text-text placeholder:text-text-muted text-sm sm:text-base focus:outline-none"
            data-testid="command-palette-input"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-text-muted hover:text-text rounded-sm mr-2"
              aria-label="Clear search input"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-text-muted bg-surface-muted border border-border rounded-sm">
            ESC
          </kbd>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-muted/30 border-b border-border overflow-x-auto text-xs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-contrast font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-border/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border/30"
        >
          {filteredProducts.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-text-muted mx-auto" />
              <p className="text-sm font-semibold text-text">No hardware matching "{query}"</p>
              <p className="text-xs text-text-muted">
                Try searching for "Nimbus", "Keyboards", "Wireless", or "USB".
              </p>
            </div>
          ) : (
            filteredProducts.map((product, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={product.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelectProduct(product.id)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`pt-1 first:pt-0 flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-border/40 border-l-4 border-primary text-text'
                      : 'hover:bg-surface-muted/60 text-text-muted hover:text-text'
                  }`}
                  data-testid={`search-result-${product.id}`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-md bg-surface-muted border border-border p-1.5 shrink-0 flex items-center justify-center">
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-[10px] uppercase font-mono py-0">
                          {product.category}
                        </Badge>
                        <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                          ● In Stock
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-text truncate mt-0.5">
                        {product.name}
                      </h4>
                      <p className="text-xs text-text-muted truncate max-w-md hidden sm:block">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Money
                      cents={product.priceCents}
                      currency={product.currency}
                      className="font-mono text-sm font-bold text-text"
                    />
                    {isActive ? (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-text">
                        View <CornerDownLeft className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-text-muted hidden sm:block" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-border bg-surface-muted/50 flex items-center justify-between text-[11px] text-text-muted font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">↵</kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">esc</kbd>
              <span>close</span>
            </span>
          </div>
          <span className="flex items-center gap-1 text-blue-800 dark:text-blue-300 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Instant Catalog Search
          </span>
        </div>
      </div>
    </div>
  );
};
