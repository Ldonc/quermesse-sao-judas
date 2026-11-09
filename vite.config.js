import { defineConfig } from 'vite';

/**
 * No desenvolvimento local, mantenha a raiz (/).
 * Para o deploy do GitHub Pages, sirva os assets em
 * https://ldonc.github.io/quermesse-sao-judas/.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_PAGES === 'true'
    ? '/quermesse-sao-judas/'
    : '/',
}));
