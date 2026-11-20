import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', hasError = false, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={`w-full h-10 px-3 py-2 text-sm bg-surface text-text border rounded-sm transition-colors placeholder:text-text-muted/60 disabled:opacity-50 disabled:bg-border/20 ${
          hasError
            ? 'border-danger focus-visible:outline-danger'
            : 'border-border focus-visible:border-primary'
        } ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
