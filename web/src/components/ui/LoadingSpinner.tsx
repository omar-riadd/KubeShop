import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-24 gap-3 text-text-muted"
    >
      <div
        aria-hidden="true"
        className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin"
      />
      <span className="text-sm font-medium">Loading…</span>
    </div>
  );
};
