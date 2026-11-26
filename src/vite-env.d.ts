/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Dev only: the admin email test mode acts as on the Settings page. */
    readonly VITE_DEV_EMAIL?: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
