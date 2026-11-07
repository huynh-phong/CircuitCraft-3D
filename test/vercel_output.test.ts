/**
 * Checks what will be deployed: builds .vercel/output, loads the function bundle the way the platform
 * does (a plain require of index.js in an empty folder, no node_modules, read-only intent) and applies
 * the generated routes to each request. Vercel itself is not involved; this is not an online test.
 *
 * Run with: npx tsx test/vercel_output.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CATALOG_DESIGNS } from '../src/server/catalogDesigns.ts';
import { startFakeSupabase } from './helpers/fakeSupabase.ts';

const REPO_ROOT = process.cwd();
const OUTPUT = path.join(REPO_ROOT, '.vercel', 'output');
const FUNCTION_DIR = path.join(OUTPUT, 'functions', 'api', 'index.func');
const PORT = 4900 + Math.floor(Math.random() * 90);

let passed = 0;
const failures: string[] = [];
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err?.message || err}`);
    console.log(`  ✗ ${name}\n      ${err?.message || err}`);
  }
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

interface Route {
  src?: string;
  dest?: string;
  status?: number;
  handle?: string;
  headers?: Record<string, string>;
  continue?: boolean;
}

/** Follows the order of Build Output API routes for one path. */
function resolveRoute(routes: Route[], pathname: string) {
  const headers: Record<string, string> = {};
  let filesystemChecked = false;
  for (const route of routes) {
    if (route.handle === 'filesystem') {
      filesystemChecked = true;
      if (fs.existsSync(path.join(OUTPUT, 'static', pathname)) && fs.statSync(path.join(OUTPUT, 'static', pathname)).isFile()) {
        return { kind: 'static' as const, file: pathname, headers };
      }
      continue;
    }
    if (!route.src || !new RegExp(route.src).test(pathname)) continue;
    Object.assign(headers, route.headers || {});
    if (route.continue) continue;
    if (route.status) return { kind: 'status' as const, status: route.status, headers };
    if (route.dest?.startsWith('/api/index')) return { kind: 'function' as const, headers };
    if (route.dest) return { kind: 'static' as const, file: route.dest, headers };
  }
  return { kind: 'none' as const, headers, filesystemChecked };
}

async function main() {
  console.log('\n[1] Build');
  // No Supabase credentials or data reach the build
  const buildEnv = { ...process.env };
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY']) delete buildEnv[key];
  const dataHash = () =>
    fs.existsSync('data')
      ? walk('data').sort().map((f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join()
      : '';
  const before = dataHash();
  execFileSync(process.execPath, [path.join('scripts', 'build-vercel.mjs')], { cwd: REPO_ROOT, stdio: 'pipe', env: buildEnv });
  const config = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'config.json'), 'utf-8'));
  const routes: Route[] = config.routes;

  await check('Build không đọc/đổi dữ liệu thật', () => assert.equal(dataHash(), before));
  await check('Cấu trúc Build Output đúng phiên bản 3, runtime Node 22', () => {
    assert.equal(config.version, 3);
    const vc = JSON.parse(fs.readFileSync(path.join(FUNCTION_DIR, '.vc-config.json'), 'utf-8'));
    assert.equal(vc.runtime, 'nodejs22.x');
    assert.equal(vc.handler, 'index.js');
    assert.equal(vc.launcherType, 'Nodejs');
    assert.ok(fs.existsSync(path.join(OUTPUT, 'static', 'index.html')));
  });
  await check('Function nhỏ hơn giới hạn 250 MB', () => {
    const size = walk(FUNCTION_DIR).reduce((n, f) => n + fs.statSync(f).size, 0);
    console.log(`      function bundle: ${(size / 1024 / 1024).toFixed(2)} MB (đo thực tế)`);
    assert.ok(size < 250 * 1024 * 1024);
  });

  console.log('\n[2] Routing (deep links, unknown API, caching)');
  for (const pathname of ['/', '/projects', '/editor', '/courses', '/my-courses', '/theory-learning', '/marketplace', '/membership', '/creator', '/admin']) {
    await check(`SPA: ${pathname} trả index.html`, () => {
      const r = resolveRoute(routes, pathname);
      assert.equal(r.kind, 'static');
      assert.equal((r as any).file, pathname === '/' ? '/index.html' : '/index.html');
    });
  }
  await check('/api/* vào function trước SPA, kể cả đường dẫn không tồn tại', () => {
    assert.equal(resolveRoute(routes, '/api/courses').kind, 'function');
    assert.equal(resolveRoute(routes, '/api/khong-ton-tai').kind, 'function');
    assert.equal(resolveRoute(routes, '/api').kind, 'function');
  });
  await check('Tài nguyên có hash được cache lâu dài; asset thiếu trả 404, không trả HTML', () => {
    const asset = fs.readdirSync(path.join(OUTPUT, 'static', 'assets')).find((f) => f.endsWith('.js'))!;
    const r = resolveRoute(routes, `/assets/${asset}`);
    assert.equal(r.kind, 'static');
    assert.match(r.headers['Cache-Control'], /immutable/);
    assert.equal((resolveRoute(routes, '/assets/khong-co.js') as any).status, 404);
  });
  await check('index.html không bị gắn cache dài', () => {
    assert.equal(resolveRoute(routes, '/courses').headers['Cache-Control'], undefined);
  });

  console.log('\n[3] What browsers receive');
  const clientFiles = walk(path.join(OUTPUT, 'static')).filter((f) => /\.(js|css|html|map)$/.test(f));
  const clientText = clientFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
  await check('Bản thiết kế trả phí không có trong JavaScript gửi tới trình duyệt', async () => {
    const { CATALOG_PRODUCTS } = await import('../src/marketplace/catalogData.ts');
    for (const product of CATALOG_PRODUCTS.filter((p) => p.price > 0)) {
      const design = CATALOG_DESIGNS[product.id]();
      const ids = design.components.map((c) => c.instanceId).filter((id) => id.length > 4);
      for (const id of ids) assert.ok(!clientText.includes(`'${id}'`) && !clientText.includes(`"${id}"`), `${product.id}: ${id}`);
      for (const conn of design.connections) assert.ok(!clientText.includes(`"${conn.id}"`) || conn.id.length < 4, `${product.id}: ${conn.id}`);
    }
  });
  await check('Mô hình GLB có trong output, đúng định dạng, đường dẫn client khớp', () => {
    for (const name of ['arduino_uno.glb', 'breadboard.glb']) {
      const file = path.join(OUTPUT, 'static', '3d-model', name);
      assert.ok(fs.existsSync(file), name);
      assert.equal(fs.readFileSync(file).subarray(0, 4).toString('latin1'), 'glTF', name);
      assert.ok(clientText.includes(`/3d-model/${name}`), `client references ${name}`);
      assert.equal(resolveRoute(routes, `/3d-model/${name}`).kind, 'static');
    }
  });
  await check('Client không trỏ tới localhost hay server Render', () => {
    // (supabase-js carries http://localhost:9999 as its own default; the app passes its configured URL)
    for (const bad of ['localhost:3000', '127.0.0.1:3000', 'localhost:5173', 'onrender.com']) assert.ok(!clientText.includes(bad), bad);
  });
  await check('Không có secret hay khóa quản trị trong client', () => {
    for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'service_role', 'SESSION_SECRET', 'BREVO_API_KEY', 'GEMINI_API_KEY', '0988888888']) {
      assert.ok(!clientText.includes(secret), secret);
    }
  });
  await check('Function bundle không chứa giá trị secret của máy build', () => {
    const bundle = fs.readFileSync(path.join(FUNCTION_DIR, 'index.js'), 'utf-8');
    const envFile = path.join(REPO_ROOT, '.env');
    if (!fs.existsSync(envFile)) return;
    for (const line of fs.readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]*(?:KEY|SECRET|PASS|PASSWORD|TOKEN)[A-Z0-9_]*)=(.{12,})$/.exec(line.trim());
      if (match) assert.ok(!bundle.includes(match[2].replace(/^["']|["']$/g, '')), `${match[1]} leaked`);
    }
  });

  console.log('\n[4] The bundle running alone, as on the platform');
  const supabase = await startFakeSupabase(REPO_ROOT);
  // Only the function folder is copied: if the bundle needed node_modules, this would fail
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc3d-func-'));
  fs.cpSync(FUNCTION_DIR, runDir, { recursive: true });
  const launcher = path.join(runDir, 'launcher.cjs');
  fs.writeFileSync(
    launcher,
    `const http = require('http');
     const handler = require('./index.js');
     if (typeof handler !== 'function') { console.error('handler is not a function'); process.exit(9); }
     http.createServer(handler).listen(${PORT}, '127.0.0.1', () => console.log('ready'));`
  );
  const child = spawn(process.execPath, [launcher], {
    cwd: runDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      VERCEL: '1',
      NODE_ENV: 'production',
      SUPABASE_URL: supabase.url,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      PAYMENT_MODE: 'mock',
      ADMIN_EMAIL: 'cc3d.admin@circuitcraft.test',
    } as any,
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));

  try {
    const base = `http://127.0.0.1:${PORT}`;
    const deadline = Date.now() + 30_000;
    for (;;) {
      if (child.exitCode !== null) throw new Error(`Function exited (${child.exitCode}): ${logs}`);
      if (logs.includes('ready')) break;
      if (Date.now() > deadline) throw new Error(`Function did not load: ${logs}`);
      await new Promise((r) => setTimeout(r, 100));
    }

    await check('Hàm tải được mà không cần node_modules; /api/health báo chế độ remote', async () => {
      const res = await fetch(`${base}/api/health`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.persistence, 'remote');
      assert.deepEqual(data.missingSettings, []);
    });
    await check('API thật hoạt động qua Supabase (danh sách khóa học, xem trước sản phẩm)', async () => {
      assert.equal((await fetch(`${base}/api/courses`)).status, 200);
      const preview = await (await fetch(`${base}/api/products/prod-terminal-splitter/preview`)).json();
      assert.equal(preview.preview.connections.length, 0);
    });
    await check('Đường dẫn gốc đến được Express theo cả hai cách nền tảng chuyển URL sau rewrite', async () => {
      const viaRewrite = await fetch(`${base}/api/index?__path=${encodeURIComponent('/health')}`);
      assert.equal((await viaRewrite.json()).status, 'ok');
      const withQuery = await fetch(`${base}/api/products/prod-led-dimmer/preview?__path=/products/prod-led-dimmer/preview&x=1`);
      assert.equal(withQuery.status, 200);
    });
    await check('Cold start không chạy migration hay DDL', () => {
      const bundle = fs.readFileSync(path.join(FUNCTION_DIR, 'index.js'), 'utf-8');
      // The project's own SQL is never shipped (library doc comments mention CREATE TABLE, so look for ours)
      for (const ours of ['cc_documents (', 'CREATE OR REPLACE FUNCTION', '20261105000000', 'storage.buckets']) assert.ok(!bundle.includes(ours), ours);
      const allowed = new Set(['cc_documents_since', 'cc_put_documents', 'cc_otp_put', 'cc_otp_verify', 'cc_otp_delete', 'cc_rate_limit_hit', 'cc_rate_limit_peek']);
      for (const name of Object.keys(supabase.rpcCalls)) assert.ok(allowed.has(name), name);
    });
    await check('API không tồn tại trả JSON 404, không phải HTML', async () => {
      const res = await fetch(`${base}/api/khong-ton-tai`);
      assert.equal(res.status, 404);
      assert.match(res.headers.get('content-type') || '', /json/);
    });
    await check('Vượt giới hạn dung lượng trả 413 JSON của ứng dụng', async () => {
      const res = await fetch(`${base}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pad: 'x'.repeat(200 * 1024) }),
      });
      assert.equal(res.status, 413);
      assert.equal((await res.json()).code, 'PAYLOAD_TOO_LARGE');
    });
    await check('Không tạo tệp trên đĩa khi xử lý request', () => {
      assert.ok(!fs.existsSync(path.join(runDir, 'data')), 'data/ must not appear');
    });
    await check('Client không gọi ngược: bundle không kéo Vite vào production', () => {
      const bundle = fs.readFileSync(path.join(FUNCTION_DIR, 'index.js'), 'utf-8');
      assert.ok(!bundle.includes('createViteServer'));
    });
  } finally {
    child.kill();
    await supabase.stop();
    fs.rmSync(runDir, { recursive: true, force: true, maxRetries: 3 });
  }

  console.log(`\nVercel output: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
