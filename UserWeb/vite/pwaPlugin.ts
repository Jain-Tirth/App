import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import type { Plugin, ResolvedConfig } from 'vite';

const PUBLIC_PRECACHE = /\.(png|ico|webmanifest)$/i;

/**
 * Emits /sw.js from src/pwa/sw.ts at build time. The precache list is the built JS and CSS, the
 * app shell ("/") and the manifest and icons from public/. The build id (and so the cache name)
 * changes whenever any of those files changes, which is what makes a new worker "waiting".
 */
export function pwaPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'dhobi-pwa-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((name) => /\.(js|css)$/.test(name))
        .map((name) => `/${name}`)
        .sort();
      const publicFiles = readdirSync(config.publicDir)
        .filter((name) => PUBLIC_PRECACHE.test(name))
        .sort();
      const precache = ['/', ...built, ...publicFiles.map((name) => `/${name}`)];

      const hash = createHash('sha256');
      for (const url of built) hash.update(url);
      for (const name of publicFiles) hash.update(readFileSync(join(config.publicDir, name)));
      const buildId = hash.digest('hex').slice(0, 12);

      const result = await build({
        entryPoints: [join(config.root, 'src/pwa/sw.ts')],
        bundle: true,
        minify: true,
        write: false,
        format: 'iife',
        target: 'es2020',
        define: {
          __BUILD_ID__: JSON.stringify(buildId),
          __PRECACHE_URLS__: JSON.stringify(precache),
        },
      });

      this.emitFile({ type: 'asset', fileName: 'sw.js', source: result.outputFiles[0].text });
      console.log(`[pwa] emitted sw.js (build ${buildId}, ${precache.length} precache entries)`);
    },
  };
}
