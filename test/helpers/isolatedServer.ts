/**
 * Starts the real CircuitCraft server (server.ts) in an ISOLATED temporary working directory.
 *
 * - `process.cwd()` decides where data/*.json live, so the repository's data is never touched.
 * - No .env exists in the temp directory and every provider credential is blanked, so the
 *   server cannot reach Supabase production, Gemini, Brevo/SMTP or Twilio.
 */
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');

const BLANKED_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'GMAIL_USER',
  'GMAIL_PASS',
  'GMAIL_APP_PASSWORD',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'PAYMENT_MODE',
  'PAYMENT_ACCOUNT_NUMBER',
  'PAYMENT_ACCOUNT_NAME',
  'PAYMENT_BANK_NAME',
  'PAYMENT_BANK_ID',
  'PERSISTENCE_BACKEND',
  'ENABLE_MOCK_PAYMENT',
  'ENABLE_DEV_OTP_PREVIEW',
  'SESSION_SECRET',
  'ADMIN_EMAIL',
  'TRUST_PROXY',
  'RENDER',
  'VERCEL',
];

export function createIsolatedDataDir(prefix = 'cc3d-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  return dir;
}

export interface RunningServer {
  baseUrl: string;
  cwd: string;
  stop: () => Promise<void>;
  logs: () => string;
}

export async function startIsolatedServer(options: {
  cwd: string;
  port: number;
  env: Record<string, string>;
}): Promise<RunningServer> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  for (const key of BLANKED_ENV) env[key] = '';
  Object.assign(env, { PORT: String(options.port), DISABLE_HMR: 'true' }, options.env);

  const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const child: ChildProcess = spawn(process.execPath, [tsxCli, path.join(REPO_ROOT, 'server.ts')], {
    cwd: options.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout?.on('data', (d) => (output += d.toString()));
  child.stderr?.on('data', (d) => (output += d.toString()));

  const baseUrl = `http://127.0.0.1:${options.port}`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (code ${child.exitCode}).\n${output}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      // A 503 health answer also means the server is up (a misconfiguration is being reported)
      if (res.ok || res.status === 503) break;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (Date.now() >= deadline) {
    child.kill();
    throw new Error(`Server did not start in time.\n${output}`);
  }

  return {
    baseUrl,
    cwd: options.cwd,
    logs: () => output,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', () => resolve());
        child.kill();
        setTimeout(() => resolve(), 3000);
      }),
  };
}

export function api(baseUrl: string) {
  return async function call(
    method: string,
    route: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; data: any }> {
    const res = await fetch(`${baseUrl}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: any = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
