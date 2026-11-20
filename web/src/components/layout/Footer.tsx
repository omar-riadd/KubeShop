import React from 'react';
import { useRuntimeConfig } from '../../api/runtimeConfig';

export const Footer: React.FC = () => {
  const { data: config } = useRuntimeConfig();

  const env = config?.environment || 'local';
  const version = config?.version || 'dev';
  const gitSha = config?.gitSha || 'local';

  return (
    <footer className="mt-auto border-t border-border bg-surface/50 text-text-muted py-6">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <p>© KubeShop demo · Gear for engineers</p>
        <div className="flex items-center gap-3 font-mono">
          <span>
            env: <span className="font-semibold text-text">{env}</span>
          </span>
          <span>·</span>
          <span>
            version:{' '}
            <span className="text-text" title={gitSha}>
              {version}
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
};
