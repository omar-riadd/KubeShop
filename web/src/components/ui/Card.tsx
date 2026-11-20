import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

export const Card: React.FC<CardProps> = ({
  as: Component = 'div',
  children,
  className = '',
  ...props
}) => {
  return (
    <Component
      className={`bg-surface border border-border rounded-md p-4 transition-colors ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
