import React from 'react';
import { formatMoney } from '../../lib/money';

export interface MoneyProps {
  cents?: number;
  priceCents?: number;
  currency?: string;
  className?: string;
}

export const Money: React.FC<MoneyProps> = ({
  cents,
  priceCents,
  currency = 'USD',
  className = '',
}) => {
  const amount = priceCents ?? cents ?? 0;
  return <span className={`font-mono ${className}`}>{formatMoney(amount, currency)}</span>;
};
