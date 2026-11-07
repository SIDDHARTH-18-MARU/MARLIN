import { readdir, readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import type { Plugin } from 'vite';

// Carry package notices into the static artifact, where its bundled JS is distributed.
export function bundledNotices(): Plugin {
  return {
    name: 'marlin-bundled-notices',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const roots = new Set<string>();
      const remember = (id: string) => {
        const file = id.replaceAll('\\', '/');
        const boundary = '/node_modules/';
        const offset = file.lastIndexOf(boundary);
        if (offset < 0 || id.startsWith('\0')) return;
        const parts = file.slice(offset + boundary.length).split('/');
        const scopeSize = parts[0]?.startsWith('@') ? 2 : 1;
        if (parts.length > scopeSize) {
          roots.add(normalize(file.slice(0, offset + boundary.length) + parts.slice(0, scopeSize).join('/')));
        }
      };
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') Object.keys(output.modules).forEach(remember);
      }
      // CSS themes and Cesium's copied runtime assets do not always appear as JS modules.
      const dependencies = ['cesium', 'tailwindcss'];
      const root = this.environment.config.root;
      dependencies.forEach(name => roots.add(join(root, 'node_modules', name)));
      const notices = await Promise.all([...roots].sort().map(async packageRoot => {
        const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
        const key = metadata.name + '@' + metadata.version;
        const files = (await readdir(packageRoot, { withFileTypes: true })).filter(entry =>
          entry.isFile() && /^(?:licen[sc]es?|copying|copyright|notice|third[-_ ]?party[-_ ]?(?:licenses?|notices?))(?:[._-].+)?$/i.test(entry.name),
        ).map(entry => entry.name).sort();
        const texts = await Promise.all(files.map(async name => name + '\n\n' + await readFile(join(packageRoot, name), 'utf8')));
        if (key === '@react-three/fiber@9.7.0') {
          texts.push(await readFile(join(root, 'docs/third-party/react-three-fiber-9.7.0.txt'), 'utf8'));
        }
        if (key === 'victory-vendor@37.3.6') {
          texts.push(await readFile(join(root, 'docs/third-party/victory-vendor-37.3.6.txt'), 'utf8'));
          const directory = join(packageRoot, 'lib-vendor');
          for (const name of (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
            texts.push(name + ' (vendored)\n\n' + await readFile(join(directory, name, 'LICENSE'), 'utf8'));
          }
        }
        if (key === 'mersenne-twister@1.1.0') {
          const code = await readFile(join(packageRoot, 'src/mersenne-twister.js'), 'utf8');
          const notice = code.match(/Copyright \(C\) 1997 - 2002,[\s\S]+?POSSIBILITY OF SUCH DAMAGE\./)?.[0];
          if (notice) texts.push('Notice retained from src/mersenne-twister.js:\n\n' + notice);
        }
        if (key === 'bitmap-sdf@1.0.4') {
          const readme = await readFile(join(packageRoot, 'readme.md'), 'utf8');
          const attribution = readme.match(/^\(c\) 2017 Dima Yv\. MIT License\r?\n\s*Development supported by plot\.ly\./m)?.[0];
          if (metadata.license !== 'MIT' || !attribution) {
            throw new Error('Locked bitmap-sdf MIT declaration or attribution changed');
          }
          const license = await readFile(join(root, 'docs/third-party/bitmap-sdf-MIT-SPDX.txt'), 'utf8');
          texts.push('Upstream package readme attribution:\n\n' + attribution +
            '\n\nMIT license text from the SPDX License List (the upstream copyright is given above):\n\n' + license);
        }
        if (!texts.length) {
          const warning = 'Bundled package notice needs review: ' + key;
          this.warn(warning);
          texts.push(warning);
        }
        return key + ' (' + (metadata.license ?? 'see text') + ')\n\n' + texts.join('\n\n');
      }));
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: await readFile(join(root, 'LICENSE')) });
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD-PARTY-NOTICES.txt',
        source: 'MARLIN static build: third-party notices\n\n' +
          'MARLIN build modification: the Cesium engine Source/Core/Ion.js default access token is removed from the production bundle.\n\n' +
          notices.join('\n\n' + '='.repeat(72) + '\n\n'),
      });
    },
  };
}
