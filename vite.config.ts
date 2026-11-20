import { defineConfig } from 'vite';
import { localApi } from './src/server/local-api';
import { LeaderboardStore } from './src/server/leaderboard-store';

export default defineConfig({
  plugins:[{name:'local-leaderboard',configureServer(server){server.middlewares.use(localApi(new LeaderboardStore()));}}],
  base: './',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  server: {
    port: 5173,
    host: true,
  },
});
