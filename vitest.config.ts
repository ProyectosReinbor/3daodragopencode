import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/game/*.ts'],
      exclude: ['src/game/game.ts', 'src/game/world.ts', 'src/game/input.ts'],
    },
  },
});
