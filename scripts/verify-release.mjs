import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const safeName = name => /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(name) &&
  name.split('/').every(part => !['.', '..', '.git', '.private', 'node_modules', 'dist'].includes(part.toLowerCase()) &&
    !/^\.env(?:$|\.)/i.test(part));

async function list(root, prefix = '') {
  const output = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const file = prefix ? prefix + '/' + name : name;
    assert.ok(safeName(file), 'Invalid path: ' + file);
    const stat = await lstat(join(root, file));
    if (stat.isDirectory()) output.push(...await list(root, file));
    else {
      assert.ok(stat.isFile() && stat.nlink === 1, 'Expected a regular, unlinked file: ' + file);
      output.push(file);
    }
  }
  return output.sort();
}

async function source() {
  const expected = (await readFile('scripts/release-source.txt', 'utf8')).trim().split(/\r?\n/);
  assert.deepEqual(expected, [...expected].sort(), 'Source allowlist must be sorted');
  assert.equal(new Set(expected.map(path => path.toLowerCase())).size, expected.length, 'Case collision in allowlist');
  const entries = git('ls-files', '--stage', '-z').split('\0').filter(Boolean).map(entry => {
    const match = /^100(?:644|755) [0-9a-f]+ 0\t(.+)$/.exec(entry);
    assert.ok(match && safeName(match[1]), 'Unexpected git index mode or path');
    return match[1];
  }).sort();
  assert.deepEqual(entries, expected, 'Git index differs from reviewed source allowlist');
  for (const file of entries) {
    const stat = await lstat(file);
    assert.ok(stat.isFile() && stat.nlink === 1, 'Not a regular source file: ' + file);
  }
  git('diff', '--quiet', '--');
  console.log('Verified ' + entries.length + ' allowlisted Git index paths');
}

async function artifact(dist) {
  const expected = new Set(['index.html', 'THIRD-PARTY-NOTICES.txt']);
  const add = async (sourceRoot, relativePath, outputPath) => {
    const destination = join(dist, outputPath);
    const entry = await lstat(destination);
    assert.ok(entry.isFile() && entry.nlink === 1);
    assert.equal(await hash(destination), await hash(join(sourceRoot, relativePath)), 'Copied asset differs: ' + outputPath);
    expected.add(outputPath);
  };
  await add('.', 'LICENSE', 'LICENSE.txt');
  const publicFiles = await list('public');
  const publicPaths = git('ls-files', '-z', '--', 'public').split('\0').filter(Boolean).sort();
  assert.deepEqual(publicFiles.map(path => 'public/' + path), publicPaths, 'Unexpected input in public/');
  for (const file of publicFiles) await add('public', file, file);
  const cesium = 'node_modules/cesium/Build/Cesium';
  for (const directory of ['Assets', 'ThirdParty', 'Workers', 'Widgets']) {
    for (const file of await list(join(cesium, directory))) {
      await add(cesium, directory + '/' + file, 'cesium/' + directory + '/' + file);
    }
  }
  const actual = await list(dist);
  assert.equal(new Set(actual.map(path => path.toLowerCase())).size, actual.length, 'Case collision in artifact');
  for (const path of actual) {
    if (/^assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]{8}\.(?:js|css)$/.test(path)) expected.add(path);
  }
  assert.deepEqual(actual, [...expected].sort(), 'Static output contains missing or unexpected files');
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const references = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  assert.ok(references.some(path => /^\/MARLIN\/assets\/.+\.js$/.test(path)), 'Missing Pages entry script');
  for (const url of references) {
    assert.ok(url.startsWith('/MARLIN/') && expected.has(url.slice('/MARLIN/'.length)), 'Bad Pages URL: ' + url);
  }
  const notice = await readFile(join(dist, 'THIRD-PARTY-NOTICES.txt'), 'utf8');
  assert.doesNotMatch(notice, /^Bundled package notice needs review:/m);
  const mit = (await readFile('docs/third-party/bitmap-sdf-MIT-SPDX.txt', 'utf8')).trim();
  assert.ok(notice.includes(mit) && /bitmap-sdf@1\.0\.4 \(MIT\)\s+[\s\S]*?\(c\) 2017 Dima Yv\. MIT License/.test(notice), 'Missing reviewed bitmap-sdf notice');
  console.log('Verified ' + actual.length + ' static files at /MARLIN/ with Cesium assets and notices');
}

const [mode, dist = 'dist'] = process.argv.slice(2);
if (mode === 'source') await source();
else if (mode === 'artifact') await artifact(dist);
else throw new Error('Use source or artifact [dist]');
