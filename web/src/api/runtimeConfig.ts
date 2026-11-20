import { useQuery } from '@tanstack/react-query';
import type { RuntimeConfig } from './types';

const defaultRuntimeConfig: RuntimeConfig = {
  environment: 'local',
  version: 'dev',
  gitSha: 'local',
  buildTime: '',
};

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/runtime-config.json', {
      headers: { 'Cache-Control': 'no-store' },
    });
    if (!res.ok) {
      return defaultRuntimeConfig;
    }
    const data = await res.json();
    return {
      environment: data.environment || 'local',
      version: data.version || 'dev',
      gitSha: data.gitSha || 'local',
      buildTime: data.buildTime || '',
    };
  } catch {
    return defaultRuntimeConfig;
  }
}

export function useRuntimeConfig() {
  return useQuery({
    queryKey: ['runtimeConfig'],
    queryFn: fetchRuntimeConfig,
    staleTime: Infinity,
  });
}
