import React from 'react';
import { Spinner } from './Spinner';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'secondary' | 'default';
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      label,
      size = 'md',
      variant = 'default',
      loading = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizes = {
      sm: 'w-8 h-8 p-1.5',
      md: 'w-10 h-10 p-2',
      lg: 'w-12 h-12 p-3',
    };

    const variants = {
      default: 'bg-transparent hover:bg-border/30 text-text',
      ghost: 'bg-transparent hover:bg-border/30 text-text',
      secondary: 'bg-surface border border-border hover:bg-border/20 text-text',
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center rounded-sm transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
