/**
 * CircuitCraft 3D - Payment mode configuration (server-side only).
 *
 * MOCK mode: simulated VietQR checkout used for development / demo. No money is transferred;
 *            orders are flagged `isMock: true` and never counted as real revenue.
 * REAL mode: a payment is only confirmed by a trusted source (an admin marking the order paid
 *            today, a bank/gateway webhook in the future). The mock endpoint is fully locked.
 *
 * Resolution:
 *   PAYMENT_MODE=real                      -> real (always wins, locks mock)
 *   PAYMENT_MODE=mock / ENABLE_MOCK_PAYMENT=true -> mock
 *   unset + NODE_ENV !== 'production'       -> mock (local development keeps working out of the box)
 *   unset + NODE_ENV === 'production'       -> real (an internet demo must opt in explicitly)
 *
 * The client can read the mode (to label the checkout) but can never change it.
 */

export type PaymentMode = 'mock' | 'real';

export function getPaymentMode(): PaymentMode {
  const mode = (process.env.PAYMENT_MODE || '').trim().toLowerCase();
  if (mode === 'real') return 'real';
  if (mode === 'mock' || process.env.ENABLE_MOCK_PAYMENT === 'true') return 'mock';
  return process.env.NODE_ENV === 'production' ? 'real' : 'mock';
}

export function isMockPaymentAllowed(): boolean {
  return getPaymentMode() === 'mock';
}

/**
 * Orders created before payment modes existed were all confirmed through the simulated
 * checkout (there has never been a bank integration), so they are classified as mock.
 */
export function isMockOrder(order: { isMock?: boolean; paymentMode?: string } | null | undefined): boolean {
  if (!order) return false;
  if (order.isMock === true) return true;
  return order.paymentMode !== 'real';
}
