/**
 * Produces Vercel's Build Output (.vercel/output):
 *   static/                    client files, served by the CDN (no rendering per visit)
 *   functions/api/index.func/  the Express API as one Node function, bundled with its dependencies
 *   config.json                routes: /api/* to the function, everything else to files or the SPA
 *
 * Only builds. It reads no project data and never talks to Supabase.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.vercel', 'output');
const functionDir = path.join(output, 'functions', 'api', 'index.func');
const region = (process.env.VERCEL_FUNCTION_REGION || 'sin1').trim();

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(functionDir, { recursive: true });

execFileSync(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
  cwd: root,
  stdio: 'inherit',
});
fs.cpSync(path.join(root, 'dist'), path.join(output, 'static'), {
  recursive: true,
  filter: (source) => !source.endsWith('server.cjs') && !source.endsWith('server.cjs.map'),
});

await build({
  entryPoints: [path.join(root, 'src', 'server', 'vercelHandler.ts')],
  outfile: path.join(functionDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  logLevel: 'warning',
  // The platform calls the exported function directly: the Express app itself
  footer: { js: 'module.exports = module.exports.default;' },
});
fs.writeFileSync(path.join(functionDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
fs.writeFileSync(
  path.join(functionDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      maxDuration: 60,
      regions: [region],
    },
    null,
    2
  )
);

const longCache = 'public, max-age=31536000, immutable';
fs.writeFileSync(
  path.join(output, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/(.*)$', headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' }, continue: true },
        // File names under /assets contain a content hash
        { src: '^/assets/(.+)$', headers: { 'Cache-Control': longCache }, continue: true },
        { src: '^/(3d-model|picture)/(.+)$', headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' }, continue: true },
        // API first: an unknown /api path gets the API's JSON 404, never index.html
        { src: '^/api(/.*)?$', dest: '/api/index?__path=$1' },
        { handle: 'filesystem' },
        // A missing asset is a 404, not the application page
        { src: '^/(assets|3d-model|picture)/(.*)$', status: 404 },
        { src: '^/.*$', dest: '/index.html' },
      ],
    },
    null,
    2
  )
);

console.log(`Build output ready in .vercel/output (function region ${region}).`);
