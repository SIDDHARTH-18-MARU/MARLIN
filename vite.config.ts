import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'
import path from 'node:path'
import { cp } from 'node:fs/promises'
import { bundledNotices } from './scripts/bundledNotices.ts'

function cesiumBuildAssets(): Plugin {
  let config: ResolvedConfig
  let removedIonDefault = false
  return {
    name: 'marlin-cesium-build-assets',
    apply: 'build',
    config({ base = '/' }) {
      if (!base.startsWith('/') || base.startsWith('//')) {
        throw new Error('MARLIN builds require an absolute site path such as / or /MARLIN/.')
      }
      const directory = base.endsWith('/') ? base : base + '/'
      return { define: { CESIUM_BASE_URL: JSON.stringify(directory + 'cesium/') } }
    },
    configResolved(resolved) {
      config = resolved
    },
    buildStart() {
      removedIonDefault = false
    },
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/node_modules/@cesium/engine/Source/Core/Ion.js')) return
      // MARLIN uses local imagery and ellipsoid terrain. Do not embed Cesium's Ion credential.
      const declaration = /\bconst defaultAccessToken\s*=\s*"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"\s*;/g
      if ([...source.matchAll(declaration)].length !== 1) {
        throw new Error('Cesium Ion default changed; review the production bundle before release.')
      }
      removedIonDefault = true
      return {
        code: source.replace(declaration, '/*! MARLIN build modification: removed the Cesium Ion default token. */\nconst defaultAccessToken = undefined;'),
        map: null,
      }
    },
    generateBundle() {
      if (!removedIonDefault) throw new Error('Expected Cesium Ion module was not reviewed by the build.')
    },
    async writeBundle() {
      const source = path.join(config.root, 'node_modules/cesium/Build/Cesium')
      const destination = path.resolve(config.root, config.build.outDir, 'cesium')
      await Promise.all(['Assets', 'ThirdParty', 'Workers', 'Widgets'].map(directory =>
        cp(path.join(source, directory), path.join(destination, directory), { recursive: true })))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), { ...cesium(), apply: 'serve' }, cesiumBuildAssets(), bundledNotices()],
  server: {
    host: '127.0.0.1',
    fs: {
      allow: [import.meta.dirname],
      deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.private/**'],
    },
    watch: { ignored: ['**/.private/**'] },
  },
  preview: { host: '127.0.0.1' },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
