import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// На GitHub адрес приложения выглядит как https://<логин>.github.io/<репозиторий>/,
// поэтому имя репозитория берём из переменной, которую GitHub даёт при сборке.
const repo = process.env.GITHUB_REPOSITORY || '';

export default defineConfig({
  plugins: [react()],
  base: repo ? `/${repo.split('/')[1]}/` : './',
  define: {
    __DEFAULT_REPO__: JSON.stringify(repo),
  },
});
