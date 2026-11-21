import React, { useState } from 'react';
import {
  Activity,
  Server,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  BarChart2,
  Terminal,
} from 'lucide-react';
import { useServiceVersion, fetchServiceVersion } from '../api/version';
import { useRuntimeConfig } from '../api/runtimeConfig';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { formatDate } from '../lib/format';

export const StatusPage: React.FC = () => {
  const catalogQuery = useServiceVersion('catalog', 5000);
  const cartQuery = useServiceVersion('cart', 5000);
  const ordersQuery = useServiceVersion('orders', 5000);
  const { data: webConfig } = useRuntimeConfig();

  // Traffic sampler state
  const [probing, setProbing] = useState(false);
  const [probeResults, setProbeResults] = useState<{
    total: number;
    versions: Record<string, number>;
    pods: Record<string, number>;
    latencies: number[];
  } | null>(null);

  const handleManualRefresh = () => {
    catalogQuery.refetch();
    cartQuery.refetch();
    ordersQuery.refetch();
  };

  const runTrafficProbe = async () => {
    setProbing(true);
    const versions: Record<string, number> = {};
    const pods: Record<string, number> = {};
    const latencies: number[] = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const t0 = performance.now();
      try {
        const v = await fetchServiceVersion('catalog');
        const dur = Math.round(performance.now() - t0);
        latencies.push(dur);
        versions[v.version] = (versions[v.version] || 0) + 1;
        pods[v.podName] = (pods[v.podName] || 0) + 1;
      } catch {
        versions['ERROR'] = (versions['ERROR'] || 0) + 1;
      }
    }

    setProbeResults({
      total: count,
      versions,
      pods,
      latencies,
    });
    setProbing(false);
  };

  const services = [
    { name: 'catalog', label: 'Catalog Service', port: '8081', query: catalogQuery },
    { name: 'cart', label: 'Cart Service', port: '8082', query: cartQuery },
    { name: 'orders', label: 'Orders Service', port: '8083', query: ordersQuery },
  ];

  const allHealthy = services.every((s) => s.query.isSuccess && !s.query.isError);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            System Status & Rollout Monitor
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time health telemetry and canary deployment traffic inspection
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              catalogQuery.isFetching || cartQuery.isFetching || ordersQuery.isFetching
                ? 'animate-spin'
                : ''
            }`}
          />
          Refresh Telemetry
        </Button>
      </div>

      {/* High-level status banner */}
      <div
        className={`p-5 rounded-md border flex items-center gap-4 ${
          allHealthy
            ? 'bg-success/10 border-success/30 text-text'
            : 'bg-warning/10 border-warning/30 text-text'
        }`}
      >
        {allHealthy ? (
          <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
        ) : (
          <AlertTriangle className="w-7 h-7 text-warning shrink-0" />
        )}
        <div className="flex-1">
          <h2 className="text-base font-semibold">
            {allHealthy
              ? 'All Microservice Pods Operational'
              : 'Some Microservices Reporting Errors'}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Auto-polling versions every 5 seconds. Pod metadata reflects live container runtime
            state.
          </p>
        </div>
        <Badge variant={allHealthy ? 'success' : 'warning'}>
          {allHealthy ? 'HEALTHY' : 'DEGRADED'}
        </Badge>
      </div>

      {/* Services Grid */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          Backend Microservices
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((svc) => {
            const { data, isLoading, isError, error } = svc.query;
            const isUp = Boolean(data && !isError);

            return (
              <Card key={svc.name} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isUp ? 'bg-success animate-pulse' : 'bg-danger'
                        }`}
                      />
                      <h3 className="font-semibold text-text text-sm">{svc.label}</h3>
                    </div>
                    <Badge variant={isUp ? 'success' : 'danger'}>{isUp ? 'UP' : 'DOWN'}</Badge>
                  </div>

                  {isLoading ? (
                    <div className="py-8 flex items-center justify-center">
                      <Spinner size="md" />
                    </div>
                  ) : isError || !data ? (
                    <div className="py-6 text-xs text-danger space-y-1">
                      <p className="font-semibold">Failed to fetch version info</p>
                      <p className="text-text-muted font-mono truncate">
                        {error instanceof Error ? error.message : 'Connection refused'}
                      </p>
                    </div>
                  ) : (
                    <dl className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <dt className="text-text-muted">Version</dt>
                        <dd className="font-mono font-medium text-text">{data.version}</dd>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <dt className="text-text-muted">Commit SHA</dt>
                        <dd className="font-mono text-text">
                          {data.gitSha ? data.gitSha.substring(0, 7) : 'local'}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <dt className="text-text-muted">Environment</dt>
                        <dd className="font-mono text-text uppercase">{data.environment}</dd>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <dt className="text-text-muted">Pod Name</dt>
                        <dd
                          className="font-mono text-text truncate max-w-[150px]"
                          title={data.podName}
                        >
                          {data.podName}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1">
                        <dt className="text-text-muted">Build Time</dt>
                        <dd className="text-text truncate max-w-[150px]">
                          {data.buildTime ? formatDate(data.buildTime) : 'N/A'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted font-mono">
                  <span>Port: :{svc.port}</span>
                  <span>/api/{svc.name}/version</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Web & Runtime Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-text text-sm">Storefront Web SPA</h3>
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/50">
              <dt className="text-text-muted">Environment</dt>
              <dd className="font-mono uppercase font-medium text-text">
                {webConfig?.environment || 'local'}
              </dd>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <dt className="text-text-muted">SPA Version</dt>
              <dd className="font-mono text-text">{webConfig?.version || '1.0.0'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <dt className="text-text-muted">Git SHA</dt>
              <dd className="font-mono text-text">
                {webConfig?.gitSha ? webConfig.gitSha.substring(0, 7) : 'local'}
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-muted">Rendering Architecture</dt>
              <dd className="text-text">Static Nginx + Vite CSR</dd>
            </div>
          </dl>
        </Card>

        {/* Argo Rollout Canary Simulator */}
        <Card className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text text-sm">Canary Traffic Sampler</h3>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={runTrafficProbe}
              isLoading={probing}
              className="gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              Probe 20 Requests
            </Button>
          </div>

          <div className="mt-4">
            <p className="text-xs text-text-muted mb-4">
              Sends 20 burst requests to{' '}
              <code className="font-mono text-text">/api/catalog/version</code> to inspect canary
              traffic splitting across pods during Argo Rollouts.
            </p>

            {probeResults ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-text">
                    <span>Version Distribution</span>
                    <span>
                      Avg Latency:{' '}
                      {Math.round(
                        probeResults.latencies.reduce((a, b) => a + b, 0) /
                          probeResults.latencies.length
                      )}
                      ms
                    </span>
                  </div>

                  {Object.entries(probeResults.versions).map(([v, count]) => {
                    const pct = Math.round((count / probeResults.total) * 100);
                    return (
                      <div key={v} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-text">{v}</span>
                          <span className="text-text-muted">
                            {count}/{probeResults.total} ({pct}%)
                          </span>
                        </div>
                        <svg
                          viewBox="0 0 100 10"
                          preserveAspectRatio="none"
                          role="img"
                          aria-label={`${v}: ${pct}%`}
                          className="w-full h-2.5 bg-surface-muted rounded-full overflow-hidden block"
                        >
                          <rect
                            x="0"
                            y="0"
                            width={pct}
                            height="10"
                            rx="5"
                            className="fill-primary transition-all duration-500"
                          />
                        </svg>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-medium text-text mb-1.5">Pods Responded:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(probeResults.pods).map(([pod, count]) => (
                      <span
                        key={pod}
                        className="inline-flex items-center gap-1 font-mono text-[10px] bg-surface-muted border border-border px-2 py-0.5 rounded text-text-muted"
                      >
                        {pod}: <strong className="text-text">{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 border border-dashed border-border rounded text-center text-xs text-text-muted">
                Click "Probe 20 Requests" to inspect live traffic distribution
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
