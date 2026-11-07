/**
 * Single source of truth for membership plan prices (VND / month).
 *
 * Used by the server checkout (authoritative charge), the Membership page and the admin
 * dashboard. Historical orders keep the amount stored at purchase time.
 *
 * NOTE: 99.000 ₫ / 249.000 ₫ are the prices shown to customers and charged by the server
 * before this refactor; the admin dashboard previously displayed a different, hard-coded
 * pair (49.000 ₫ / 120.000 ₫). Confirm with the product owner before changing these values.
 */
export const MEMBERSHIP_PLAN_PRICES = {
  free: 0,
  student: 99000,
  creator: 249000,
} as const;

export type MembershipTier = keyof typeof MEMBERSHIP_PLAN_PRICES;

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}
