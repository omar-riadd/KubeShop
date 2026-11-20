import React from 'react';

export interface FieldRenderProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  hasError?: boolean;
}

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode | ((props: FieldRenderProps) => React.ReactNode);
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  id,
  label,
  hint,
  error,
  required = false,
  children,
  className = '',
}) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const renderContent = () => {
    if (typeof children === 'function') {
      return (children as (props: FieldRenderProps) => React.ReactNode)({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
        hasError: Boolean(error),
      });
    }

    if (React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        id?: string;
        'aria-describedby'?: string;
        'aria-invalid'?: boolean;
        hasError?: boolean;
      }>;
      return React.cloneElement(child, {
        id: child.props.id || id,
        'aria-describedby': child.props['aria-describedby'] || describedBy,
        'aria-invalid': child.props['aria-invalid'] ?? Boolean(error),
        hasError: child.props.hasError ?? Boolean(error),
      });
    }

    return children;
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-text flex items-center gap-1">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <span id={hintId} className="text-xs text-text-muted">
          {hint}
        </span>
      )}
      {renderContent()}
      {error && (
        <span id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
};
