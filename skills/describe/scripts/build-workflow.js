#!/usr/bin/env node
// Usage (newline-delimited, default):
//   printf 'vault/A.md\nvault/B.md\n' | node build-workflow.js [--concurrency N]
//
// Usage (null-delimited, from find -print0):
//   find vault -name '*.md' -type f -print0 | node build-workflow.js -0 [--concurrency N]

'use strict';

const fs = require('fs');
const path = require('path');

// ── Parse flags from argv ────────────────────────────────────────────
let concurrency = 2;
let asNull = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--concurrency' && process.argv[i + 1]) {
    concurrency = parseInt(process.argv[++i], 10);
  } else if (process.argv[i] === '-0') {
    asNull = true;
  }
}

// ── Read paths from stdin ────────────────────────────────────────────
const raw = fs.readFileSync('/dev/stdin', 'utf8');
if (!raw.length) {
  console.error('Error: no input on stdin.');
  process.exit(1);
}

const files = (asNull ? raw.split('\0') : raw.split('\n')).filter(f => f.length > 0);
if (files.length === 0) {
  console.log('No files given — nothing to do.');
  process.exit(0);
}

// ── Read template ────────────────────────────────────────────────────
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
  console.error('Error: CLAUDE_PLUGIN_ROOT is not set.');
  process.exit(1);
}
const templatePath = path.join(pluginRoot, 'templates', 'describe-template.js');
let template;
try {
  template = fs.readFileSync(templatePath, 'utf8');
} catch (e) {
  console.error(`Error: cannot read template at ${templatePath}: ${e.message}`);
  process.exit(1);
}

// ── Build FILES array literal ────────────────────────────────────────
const filesArray = '[\n  ' + files.map(f => JSON.stringify(f)).join(',\n  ') + ',\n]';

// ── Substitute placeholders ──────────────────────────────────────────
const output = template
  .replace('{{FILES}}', filesArray)
  .replace('{{CONCURRENCY}}', String(concurrency));

// ── Write workflow file ──────────────────────────────────────────────
const outDir = path.join(require('os').homedir(), '.claude', 'workflows');
fs.mkdirSync(outDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.-]/g, '').replace(/Z$/, '');
const outFile = path.join(outDir, `describe-${ts}.js`);
fs.writeFileSync(outFile, output, 'utf8');

console.log(`Emitted workflow for ${files.length} file${files.length === 1 ? '' : 's'} with concurrency=${concurrency}: ${outFile}`);
