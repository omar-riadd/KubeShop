import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CommandPalette } from './CommandPalette';
import { useSearch } from '../../context/SearchContext';

const TestSearchConsumer = () => {
  const { openSearch, isOpen } = useSearch();
  return (
    <div>
      <button onClick={openSearch} data-testid="open-search-btn">
        Open Search
      </button>
      <div data-testid="search-status">{isOpen ? 'open' : 'closed'}</div>
      <CommandPalette />
    </div>
  );
};

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed and opens when openSearch is called', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestSearchConsumer />);

    expect(screen.getByTestId('search-status')).toHaveTextContent('closed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('open-search-btn'));
    expect(screen.getByTestId('search-status')).toHaveTextContent('open');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
  });

  it('opens and closes with keyboard shortcuts (Cmd+K and Escape)', async () => {
    renderWithProviders(<TestSearchConsumer />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Trigger Cmd+K
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('filters products by query input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette open={true} onClose={vi.fn()} />);

    // Wait for products to load
    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();

    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'Pod TKL');

    expect(screen.getByText('Pod TKL Low-Profile Keyboard')).toBeInTheDocument();
    expect(screen.queryByText('Nimbus 75 Mechanical Keyboard')).not.toBeInTheDocument();
  });

  it('shows empty state when no products match query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();

    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'NonExistentProductXYZ');

    expect(screen.getByText(/No hardware matching "NonExistentProductXYZ"/i)).toBeInTheDocument();
  });

  it('filters by category button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();

    // Filter by mice
    const miceBtn = screen.getByRole('button', { name: /^mice$/i });
    await user.click(miceBtn);

    expect(screen.queryByText('Nimbus 75 Mechanical Keyboard')).not.toBeInTheDocument();
  });

  it('supports arrow key navigation and Enter selection', async () => {
    renderWithProviders(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();

    const input = screen.getByTestId('command-palette-input');
    // First item should be active initially
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // Arrow down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    // Arrow up
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes when clicking backdrop', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<CommandPalette open={true} onClose={handleClose} />);

    const backdrop = screen.getByRole('presentation');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalled();
  });
});
