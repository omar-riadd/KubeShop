import React from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
  className = '',
}) => {
  const renderIcon = () => {
    if (!icon) return <PackageOpen className="w-6 h-6" />;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className="w-6 h-6" />;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-surface border border-dashed border-border rounded-md ${className}`}
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-border/30 text-text-muted mb-3">
        {renderIcon()}
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      {description && <p className="text-sm text-text-muted max-w-sm mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
