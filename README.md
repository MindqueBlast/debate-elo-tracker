# Syosset Debate Elo Tracker

Client-side rating tracker for Syosset Public Forum. React + Vite frontend, Supabase for data, Firebase Google Sign-In for access.

Live site: [mindqueblast.github.io/debate-elo-tracker](https://mindqueblast.github.io/debate-elo-tracker/)

## Scripts

```bash
npm install
npm run dev
npm test
npm run build
```

Copy `.env.example` to `.env` if you need to override the public Supabase/Firebase keys.

Admins can record practice rounds and tournaments. Viewers on the allowlist can follow rankings and graphs. In local development, the login screen includes a test-mode bypass.

GitHub Pages is deployed from GitHub Actions on push to `main`. You do not need Vercel for this hosting setup.


```bash
npm install
npm run dev
npm test
npm run build
```

Copy `.env.example` to `.env` if you need to override the public Supabase/Firebase keys.

Admins can record practice rounds and tournaments. Viewers on the allowlist can follow rankings and graphs. In local development, the login screen includes a test-mode bypass.
