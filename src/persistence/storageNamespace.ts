/**
 * Storage Namespace Utility for CircuitCraft 3D
 * Enforces strict per-user isolation for client-side Web Storage (localStorage / sessionStorage).
 *
 * Rule: No personal data may ever be stored in a shared global key.
 * Format: circuitcraft:{userId || 'guest'}:{subKey}
 */

export const LEGACY_GLOBAL_KEYS = [
  'circuitcraft_projects_v1',
  'circuitcraft_enrolled_courses_v1',
  'circuitcraft_completed_lessons_v1',
  'circuitcraft_account_v1',
  'circuitcraft_orders_v1',
  'circuitcraft_entitlements_v1',
  'circuitcraft_active_project_id',
  'circuitcraft_minibot_chat_v1',
  'minibot_chat_messages',
];

/**
 * Returns a strictly namespaced key for a specific user ID.
 * If no user is authenticated, uses 'guest' scope.
 */
export function getUserStorageKey(subKey: string, userId?: string | null): string {
  const scope = (userId && userId.trim()) ? userId.trim() : 'guest';
  return `circuitcraft:${scope}:${subKey}`;
}

/**
 * Removes all local storage entries associated with a specific user (or guest).
 */
export function clearUserPrivateStorage(userId?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  const scope = (userId && userId.trim()) ? userId.trim() : 'guest';
  const prefix = `circuitcraft:${scope}:`;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Error clearing user private storage:', err);
  }
}

/**
 * Clean up legacy un-namespaced keys that previously leaked data across users.
 */
export function purgeLegacyGlobalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    for (const key of LEGACY_GLOBAL_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('Error purging legacy global storage:', err);
  }
}
