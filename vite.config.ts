import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    base: process.env.GITHUB_PAGES === 'true' ? '/debate-elo-tracker/' : '/',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    firebase: ['firebase/app', 'firebase/auth'],
                    chart: ['chart.js', 'react-chartjs-2', 'chartjs-adapter-date-fns'],
                    supabase: ['@supabase/supabase-js'],
                },
            },
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
