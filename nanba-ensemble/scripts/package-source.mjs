// Package committed sources only. No working-tree secrets or production data.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const output = resolve(process.argv[2] || 'dist/release');
const git = (...args) => execFileSync('git', args, { maxBuffer: 20 * 1024 * 1024 });
const sha256 = data => createHash('sha256').update(data).digest('hex');
const sourceCommit = git('rev-parse', 'HEAD').toString().trim();
const paths = git('ls-tree', '-r', '-z', '--name-only', 'HEAD').toString().split('\0').filter(p => p && p !== 'docs/SPECIFICATION.txt');
if (paths.some(p => /^(data|sessions|node_modules)\//.test(p) || /^\.env(?:\.|$)/.test(p) && p !== '.env.example')) throw Error('private_file_in_archive');
for (const required of ['docs/AGENT_PROMPT.txt', 'src/server.ts', 'src/nanba-diaspora.ts', 'src/nanba-onboarding.ts', 'src/nanba-onboarding-copy.ts', 'src/nanba-onboarding-buttons.ts', 'scripts/start-container.sh', 'package-lock.json']) {
  if (!paths.includes(required)) throw Error('missing_runtime_file:' + required);
}
const files = paths.map(path => ({ path, sha256: sha256(git('show', sourceCommit + ':' + path)) }));
const archive = gzipSync(git('archive', '--format=tar', sourceCommit, '--', '.', ':(exclude)docs/SPECIFICATION.txt'), { level: 9 });
const manifest = { sourceCommit, release: 'assistant-v4.4-buttons', archiveSha256: sha256(archive), files };
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'nanba-ensemble-source.tar.gz'), archive);
writeFileSync(resolve(output, 'SOURCE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceCommit, files: files.length, archiveBytes: archive.length, archiveSha256: manifest.archiveSha256 }));
