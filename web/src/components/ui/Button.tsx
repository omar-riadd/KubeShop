import React from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  isLoading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      isLoading = false,
      asChild = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isSpinning = loading || isLoading;
    const base =
      'inline-flex items-center justify-center font-medium rounded-sm transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-primary text-primary-contrast hover:bg-primary-hover shadow-xs',
      secondary: 'bg-surface text-text border border-border hover:bg-border/20 shadow-xs',
      outline: 'bg-transparent text-text border border-border hover:bg-border/20 shadow-xs',
      ghost: 'bg-transparent text-text hover:bg-border/30',
      danger: 'bg-danger text-white hover:bg-danger/90 shadow-xs',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-4 py-2 gap-2 h-10',
      lg: 'text-base px-5 py-2.5 gap-2.5 h-12',
    };

    const combinedClasses = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: `${combinedClasses} ${child.props.className || ''}`.trim(),
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isSpinning}
        aria-busy={isSpinning}
        className={combinedClasses}
        {...props}
      >
        {isSpinning && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
