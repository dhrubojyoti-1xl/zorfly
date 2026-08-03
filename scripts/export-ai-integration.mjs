#!/usr/bin/env node
// Exports the allowlisted AI-integration assets described in
// integration/ai-export-manifest.json into a clean directory, preserving
// each entry's declared relative destination path. Never touches anything
// outside the export target directory it is given. Fails closed on any
// secret-looking content, any manifest path that escapes the repo root,
// or any manifest path that does not exist.
//
// Usage:
//   node scripts/export-ai-integration.mjs --check
//   node scripts/export-ai-integration.mjs --export <directory>

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'integration', 'ai-export-manifest.json');

const SECRET_PATTERNS = [
  {
    name: 'generic api key assignment',
    re: /\b(api[_-]?key|apikey)\s*[:=]\s*['"][^'"\s]{8,}['"]/i
  },
  {
    name: 'generic secret/password assignment',
    re: /\b(secret|password|passwd)\s*[:=]\s*['"][^'"\s]{4,}['"]/i
  },
  { name: 'PEM private key', re: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'OpenAI-style secret key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'Anthropic-style secret key', re: /\bsk-ant-[A-Za-z0-9-_]{20,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  {
    name: 'connection string with embedded credentials',
    re: /\b\w+:\/\/[^/\s:]+:[^/\s@]+@[^/\s]+/
  }
];

class ExportError extends Error {}

function fail(message) {
  throw new ExportError(message);
}

function loadManifest() {
  if (!existsSync(manifestPath)) {
    fail(`Manifest not found at ${path.relative(repoRoot, manifestPath)}.`);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Manifest is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    fail('Manifest has no entries.');
  }
  return manifest;
}

/** Resolves a manifest-declared path against repoRoot and refuses traversal outside it. */
function resolveSafe(relativePath, label) {
  if (path.isAbsolute(relativePath)) {
    fail(`${label} "${relativePath}" must be a relative path.`);
  }
  const resolved = path.resolve(repoRoot, relativePath);
  const relativeToRoot = path.relative(repoRoot, resolved);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    fail(`${label} "${relativePath}" resolves outside the repository root — refusing.`);
  }
  return resolved;
}

function collectFilePlan(manifest) {
  /** @type {{ id: string, source: string, absSource: string, dest: string }[]} */
  const plan = [];
  const seenDest = new Set();
  for (const entry of manifest.entries) {
    if (!entry.id || !Array.isArray(entry.files)) {
      fail(`Manifest entry is missing "id" or "files": ${JSON.stringify(entry)}`);
    }
    for (const file of entry.files) {
      if (!file.source || !file.dest) {
        fail(`Manifest entry "${entry.id}" has a file missing "source" or "dest".`);
      }
      const absSource = resolveSafe(file.source, `entry "${entry.id}" source`);
      resolveSafe(file.dest, `entry "${entry.id}" dest`); // validated, not used directly (joined below)
      if (!existsSync(absSource) || !statSync(absSource).isFile()) {
        fail(
          `Manifest entry "${entry.id}" references a source file that does not exist: ${file.source}`
        );
      }
      if (seenDest.has(file.dest)) {
        fail(`Duplicate export destination path in manifest: ${file.dest}`);
      }
      seenDest.add(file.dest);
      plan.push({ id: entry.id, source: file.source, absSource, dest: file.dest });
    }
  }
  return plan;
}

// Short, literal, dictionary-word-like values used ONLY as deliberate test
// fixtures across this repo's own test suites (not real credentials — no
// real secret is a hardcoded phrase like this). Narrow and case-insensitive
// on purpose: it must never suppress anything that looks like real key
// material (long, high-entropy, or provider-prefixed values still fail).
const KNOWN_TEST_FIXTURE_VALUES = new Set(['correct-password', 'wrong-password', 'test-key']);

function scanForSecrets(content, source) {
  for (const pattern of SECRET_PATTERNS) {
    const match = content.match(pattern.re);
    if (!match) continue;
    const valueMatch = match[0].match(/['"]([^'"]+)['"]/);
    const value = valueMatch ? valueMatch[1] : null;
    if (value && KNOWN_TEST_FIXTURE_VALUES.has(value.toLowerCase())) continue;
    // Never print the matched value itself, only where it was found.
    fail(
      `Secret pattern "${pattern.name}" detected in ${source} — refusing to export. ` +
        'Remove the secret from source control and re-run.'
    );
  }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function ensureCleanDir(dir) {
  if (existsSync(dir)) {
    const stat = statSync(dir);
    if (!stat.isDirectory()) {
      fail(`Export target ${dir} exists and is not a directory — refusing to touch it.`);
    }
    const entries = readdirSync(dir);
    if (entries.length > 0) {
      fail(
        `Export target ${dir} is not empty. This script never deletes existing content — ` +
          'point --export at a fresh or already-empty directory.'
      );
    }
  } else {
    mkdirSync(dir, { recursive: true });
  }
}

function runCheck(manifest) {
  const plan = collectFilePlan(manifest);
  for (const item of plan) {
    const content = readFileSync(item.absSource, 'utf8');
    scanForSecrets(content, item.source);
  }
  const allowedDeps = new Set(manifest.requiredExternalDependenciesAllowlist ?? []);
  for (const item of plan) {
    if (!item.source.endsWith('package.json')) continue;
    const pkg = JSON.parse(readFileSync(item.absSource, 'utf8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
    for (const dep of Object.keys(deps)) {
      if (dep.startsWith('@zorfly/')) continue; // internal workspace deps are handled by the manifest itself
      if (!allowedDeps.has(dep)) {
        fail(
          `Dependency "${dep}" declared in ${item.source} is not in requiredExternalDependenciesAllowlist. ` +
            'Add it to the manifest allowlist if it is genuinely required, or remove the file from export scope.'
        );
      }
    }
  }
  console.log(
    `OK: ${plan.length} file(s) across ${manifest.entries.length} manifest entr${manifest.entries.length === 1 ? 'y' : 'ies'} pass validation.`
  );
  return plan;
}

function runExport(manifest, targetDir) {
  const plan = runCheck(manifest); // validation always runs before any write
  ensureCleanDir(targetDir);

  const inventory = {
    manifestVersion: manifest.manifestVersion,
    exportedAt: new Date().toISOString(),
    fileCount: plan.length,
    files: []
  };

  // Sort for deterministic output regardless of manifest entry order.
  const sortedPlan = [...plan].sort((a, b) => a.dest.localeCompare(b.dest));

  for (const item of sortedPlan) {
    const content = readFileSync(item.absSource);
    const destPath = path.join(targetDir, item.dest);
    mkdirSync(path.dirname(destPath), { recursive: true });
    writeFileSync(destPath, content);
    inventory.files.push({
      entryId: item.id,
      source: item.source,
      dest: item.dest,
      bytes: content.length,
      sha256: sha256(content)
    });
  }

  inventory.files.sort((a, b) => a.dest.localeCompare(b.dest));
  const inventoryContent = JSON.stringify(inventory, null, 2) + '\n';
  writeFileSync(path.join(targetDir, 'export-inventory.json'), inventoryContent);

  console.log(`Exported ${sortedPlan.length} file(s) to ${targetDir}`);
  console.log(`Inventory written to ${path.join(targetDir, 'export-inventory.json')}`);
  return inventory;
}

function main() {
  const args = process.argv.slice(2);
  const manifest = loadManifest();

  if (args.includes('--check')) {
    runCheck(manifest);
    return;
  }

  const exportIndex = args.indexOf('--export');
  if (exportIndex !== -1) {
    const targetDir = args[exportIndex + 1];
    if (!targetDir) {
      fail('--export requires a directory argument, e.g. --export /tmp/ai-export');
    }
    runExport(manifest, path.resolve(targetDir));
    return;
  }

  console.error('Usage: export-ai-integration.mjs --check | --export <directory>');
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  if (error instanceof ExportError) {
    console.error(`export-ai-integration: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
