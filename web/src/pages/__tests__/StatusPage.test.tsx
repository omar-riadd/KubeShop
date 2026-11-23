import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { StatusPage } from '../StatusPage';

describe('StatusPage', () => {
  beforeEach(() => {
    server.use(
      http.get('/runtime-config.json', () =>
        HttpResponse.json({
          environment: 'staging',
          version: 'sha-abc1234',
          gitSha: 'abc1234def5678',
          buildTime: '2026-11-20T10:00:00Z',
        })
      )
    );
  });

  it('renders all 3 microservice health cards as HEALTHY on happy path', async () => {
    renderWithProviders(<StatusPage />);

    expect(await screen.findByText('All Microservice Pods Operational')).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText('Catalog Service')).toBeInTheDocument();
    expect(screen.getByText('Cart Service')).toBeInTheDocument();
    expect(screen.getByText('Orders Service')).toBeInTheDocument();
    expect(screen.getAllByText('UP')).toHaveLength(3);
    expect(screen.getByText('sha-abc1234')).toBeInTheDocument();
  });

  it('shows loading spinners while service version requests are pending', async () => {
    server.use(
      http.get('/api/:service/version', async ({ params }) => {
        await delay(200);
        return HttpResponse.json({
          service: params.service,
          version: 'v1.0.0',
          gitSha: '1234567',
          buildTime: '2026-11-20T10:00:00Z',
          environment: 'local',
          podName: `${String(params.service)}-pod-1`,
        });
      })
    );

    const { container } = renderWithProviders(<StatusPage />);

    expect(container.querySelectorAll('.animate-spin').length).toBeGreaterThan(0);
    expect(await screen.findByText('All Microservice Pods Operational')).toBeInTheDocument();
  });

  it('shows DEGRADED status when a backend service returns 500', async () => {
    server.use(
      http.get('/api/orders/version', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Orders down', requestId: 'req-s500' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<StatusPage />);

    expect(await screen.findByText('Failed to fetch version info')).toBeInTheDocument();
    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
    expect(screen.getByText('DOWN')).toBeInTheDocument();
  });

  it('runs canary traffic probe and renders version distribution', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusPage />);

    await screen.findByText('All Microservice Pods Operational');

    await user.click(screen.getByRole('button', { name: /probe 20 requests/i }));

    expect(await screen.findByText('Version Distribution')).toBeInTheDocument();
    expect(screen.getByText('Pods Responded:')).toBeInTheDocument();
  });
});
