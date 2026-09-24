// Fails CI if any network host other than api.nansen.ai (or the Telegram/
// Discord/webhook delivery targets Smart Alerts itself posts to) appears in
// src/. The buildathon's hard rule is "the only data source is the Nansen
// API"; this makes that a build-time guarantee instead of a promise in the
// README that quietly rots as code changes.
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

// Hosts a Smart Alert itself is *delivered to* aren't a data source — TIDE
// never reads from them — so they're allowed to appear (e.g. in the alert
// creation form's placeholder text or webhook URL validation).
const ALLOWED_HOSTS = [
  'api.nansen.ai',
  'docs.nansen.ai', // doc comments linking back to reference material
  'app.nansen.ai',  // "get an API key" links; Nansen's own public points API
  'www.nansen.ai',  // the "Powered by Nansen API" attribution link Nansen's redistribution rules require
  'x.com',          // "open post" links on the social posts Nansen returned (ra-agent); never fetched
  'api.telegram.org',
  'discord.com',
  'hooks.slack.com', // Slack webhook format check for Smart Alert destinations: Nansen posts there; TIDE never calls it
];

// Requires an explicit http(s):// prefix. A bare `a.b.c` pattern (matching
// any property-access chain — `this.tokens`, `res.headers.get`) produced
// hundreds of false positives with no protocol requirement; every real
// network target in this codebase is reached through fetch() or an href,
// both of which always carry a protocol.
const HOST_PATTERN = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;

interface Violation { file: string; line: number; host: string; text: string; }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function scan(): Violation[] {
  const violations: Violation[] = [];
  for (const file of walk(SRC_DIR)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const match of line.matchAll(HOST_PATTERN)) {
        const host = match[1].toLowerCase();
        if (ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) continue;
        violations.push({ file: path.relative(process.cwd(), file), line: i + 1, host, text: line.trim().slice(0, 120) });
      }
    });
  }
  return violations;
}

const violations = scan();
if (violations.length) {
  console.error(`assert-nansen-only: found ${violations.length} reference(s) to a host other than Nansen's API:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.host}]  ${v.text}`);
  }
  console.error(`\nIf this is a legitimate exception (a delivery target Smart Alerts posts to, a doc link), add the host to ALLOWED_HOSTS in scripts/assert-nansen-only.ts with a comment saying why.`);
  process.exit(1);
}
console.log('assert-nansen-only: clean — no non-Nansen hosts found in src/.');
