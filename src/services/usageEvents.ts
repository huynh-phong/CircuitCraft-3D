import { authService } from '../persistence/authService';

/**
 * Feature usage events for admin analytics. Only signed-in users are counted, only whitelisted event
 * names are sent and no circuit data is included. Failures are ignored: analytics must never
 * disturb the editor.
 */
export type UsageEvent = 'simulation_run' | 'simulation_error';

export function trackUsageEvent(event: UsageEvent): void {
  const headers = authService.getAuthHeaders();
  if (!headers.Authorization) return;
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {});
}
