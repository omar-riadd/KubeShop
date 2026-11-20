import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { IconButton } from './IconButton';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  'data-testid'?: string;
  id?: string;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 20,
  disabled = false,
  'data-testid': testId,
  id,
}) => {
  const handleDec = () => {
    if (value > min) onChange(value - 1);
  };

  const handleInc = () => {
    if (value < max) onChange(value + 1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      onChange(val);
    }
  };

  return (
    <div className="inline-flex items-center border border-border rounded-sm bg-surface">
      <IconButton
        label="Decrease quantity"
        size="sm"
        disabled={disabled || value <= min}
        onClick={handleDec}
        className="rounded-r-none"
      >
        <Minus className="w-3.5 h-3.5" />
      </IconButton>
      <input
        id={id}
        data-testid={testId}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Quantity"
        className="w-12 text-center text-sm font-medium bg-transparent border-none focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <IconButton
        label="Increase quantity"
        size="sm"
        disabled={disabled || value >= max}
        onClick={handleInc}
        className="rounded-l-none"
      >
        <Plus className="w-3.5 h-3.5" />
      </IconButton>
    </div>
  );
};
