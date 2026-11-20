import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuantityStepper } from './QuantityStepper';

describe('QuantityStepper component', () => {
  it('renders current value and handles inc / dec', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<QuantityStepper value={2} min={1} max={5} onChange={handleChange} />);

    expect(screen.getByRole('spinbutton')).toHaveValue(2);

    const incButton = screen.getByRole('button', { name: /increase quantity/i });
    await user.click(incButton);
    expect(handleChange).toHaveBeenCalledWith(3);

    const decButton = screen.getByRole('button', { name: /decrease quantity/i });
    await user.click(decButton);
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it('disables decrease when at min', () => {
    render(<QuantityStepper value={1} min={1} max={5} onChange={() => {}} />);
    const decButton = screen.getByRole('button', { name: /decrease quantity/i });
    expect(decButton).toBeDisabled();
  });

  it('disables increase when at max', () => {
    render(<QuantityStepper value={5} min={1} max={5} onChange={() => {}} />);
    const incButton = screen.getByRole('button', { name: /increase quantity/i });
    expect(incButton).toBeDisabled();
  });
});
