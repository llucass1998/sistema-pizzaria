import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const base = '.claude/change-groups';
fs.mkdirSync(base, { recursive: true });

function readList(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((p) => p.trim().replaceAll('\\', '/'))
    .filter(Boolean);
}

function shQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

const modified = readList(`${base}/modified-tracked.txt`);
const untracked = readList(`${base}/untracked.txt`);
const allPaths = [...modified, ...untracked];

const groups = {
  'docker-dev': new Set(),
  motoboy: new Set(),
  'ifood-seguranca': new Set(),
  relatorios: new Set(),
  'formatacao-ampla': new Set(),
  'artefatos-nao-incluir': new Set(),
};

const dockerExact = new Set([
  '.devcontainer/devcontainer.json',
  'Dockerfile.dev',
  'docker-compose.dev.yml',
  'scripts/dev.sh',
  'scripts/compose-redeploy.sh',
  'docker-entrypoint.sh',
  'scripts/redeploy-wsl.sh',
  'update.sh',
  'README.md',
  'CLAUDE.md',
  'vite.config.js',
  'eslint.config.mjs',
  'tests/e2e/public-flow.spec.ts',
]);

const motoboyExact = new Set([
  'backend-src/routes/driver.routes.ts',
  'backend-src/routes/driver.routes.spec.ts',
  'backend-src/services/driverDelivery.service.ts',
  'backend-src/routes/dispatch.routes.ts',
  'backend-src/routes/dispatch.routes.spec.ts',
  'frontend-src/App.jsx',
  'frontend-src/pages/admin/LoginPage.jsx',
  'frontend-src/pages/driver/DriverHomePage.jsx',
  'frontend-src/pages/driver/DriverLayout.jsx',
  'frontend-src/pages/driver/DriverLoginPage.jsx',
  'frontend-src/pages/driver/DriverOrderDetailsPage.jsx',
  'frontend-src/pages/driver/driverApi.js',
  'public/manifest.json',
  'public/manifest.webmanifest',
  'prisma/schema.prisma',
  'prisma/migrations/20260709000000_driver_delivery_events/migration.sql',
]);

const ifoodSecExact = new Set([
  'backend-src/integrations/ifood/ifood.service.ts',
  'backend-src/integrations/ifood/ifood.service.spec.ts',
  'backend-src/routes/integration.routes.ts',
  'backend-src/routes/webhook.routes.ts',
  'backend-src/utils/auth.ts',
  'frontend-src/pages/admin/IntegrationsPage.jsx',
]);

const reportPrefixes = [
  'RELATORIO_',
  'ADR_',
  'PLANO_',
  'MAPA_',
  'PRE_DEPLOY_',
  'TEST_',
  'ROADMAP_',
  'CHECKOUT_',
  'DEPLOY_',
  'IMPLEMENTATION_',
];
const reportsExact = new Set(['implementation_plan.md', 'task.md', 'walkthrough.md']);
const artifactExact = new Set(['tmp-seed-menu-items.ts', 'out.js']);
const artifactSuffixes = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

for (const p of allPaths) {
  const name = path.posix.basename(p);
  if (dockerExact.has(p)) groups['docker-dev'].add(p);
  else if (motoboyExact.has(p)) groups.motoboy.add(p);
  else if (ifoodSecExact.has(p)) groups['ifood-seguranca'].add(p);
  else if (
    reportPrefixes.some((prefix) => name.startsWith(prefix)) ||
    reportsExact.has(p) ||
    (name.endsWith('.md') && ['RELATORIO_', 'ADR_', 'PLANO_', 'ROADMAP_', 'TEST_'].some((prefix) => name.startsWith(prefix)))
  ) {
    groups.relatorios.add(p);
  } else if (artifactExact.has(p) || name.startsWith('tmp-') || artifactSuffixes.some((suffix) => name.endsWith(suffix))) {
    groups['artefatos-nao-incluir'].add(p);
  } else {
    groups['formatacao-ampla'].add(p);
  }
}

const seen = new Map();
for (const [group, paths] of Object.entries(groups)) {
  for (const p of paths) {
    if (seen.has(p)) throw new Error(`${p} duplicado em ${seen.get(p)} e ${group}`);
    seen.set(p, group);
  }
}

for (const [group, paths] of Object.entries(groups)) {
  const ordered = [...paths].sort();
  fs.writeFileSync(`${base}/${group}.txt`, ordered.join('\n') + (ordered.length ? '\n' : ''), 'utf8');

  const stage = ['#!/usr/bin/env bash', 'set -euo pipefail'];
  if (ordered.length) {
    stage.push('git add -- \\');
    ordered.forEach((p, index) => {
      stage.push(`  ${shQuote(p)}${index === ordered.length - 1 ? '' : ' \\'}`);
    });
  } else {
    stage.push("echo 'grupo vazio'");
  }
  fs.writeFileSync(`${base}/stage-${group}.sh`, `${stage.join('\n')}\n`, 'utf8');

  const patchPath = `${base}/${group}.patch`;
  if (group === 'artefatos-nao-incluir' || ordered.length === 0) {
    fs.writeFileSync(patchPath, '', 'utf8');
    continue;
  }

  const tracked = ordered.filter((p) => modified.includes(p));
  const newFiles = ordered.filter((p) => untracked.includes(p));
  const chunks = [];

  if (tracked.length) {
    const result = spawnSync('git', ['diff', '--', ...tracked], { encoding: 'utf8' });
    chunks.push(result.stdout || '');
  }

  for (const p of newFiles) {
    const result = spawnSync('git', ['diff', '--no-index', '--', '/dev/null', p], { encoding: 'utf8' });
    chunks.push(result.stdout || '');
  }

  fs.writeFileSync(patchPath, chunks.join('\n'), 'utf8');
}

const summary = Object.entries(groups).map(([group, paths]) => `${group}: ${paths.size} arquivo(s)`);
fs.writeFileSync(`${base}/SUMMARY.md`, `${summary.join('\n')}\n`, 'utf8');
console.log(summary.join('\n'));
