const FALLBACK = {
    supabaseUrl: 'https://fuxqbiiyrpvpxvyswzyz.supabase.co',
    supabaseAnonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1eHFiaWl5cnB2cHh2eXN3enl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjkzOTksImV4cCI6MjA2ODYwNTM5OX0.nMfZW__cQllAKmmCBEWI5rjXFhBGEv1O0gB1p64UKOE',
    firebaseApiKey: 'AIzaSyBMefj4U2hwFJ023PUzqM6C0YN_JP8PGgY',
    firebaseAuthDomain: 'syossetelotracker.firebaseapp.com',
    firebaseProjectId: 'syossetelotracker',
    firebaseAppId: '1:113119703269:web:3ad5ec93a3a0cd3fbe640c',
};

export const env = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || FALLBACK.supabaseUrl,
    supabaseAnonKey:
        import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK.supabaseAnonKey,
    firebase: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK.firebaseApiKey,
        authDomain:
            import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
            FALLBACK.firebaseAuthDomain,
        projectId:
            import.meta.env.VITE_FIREBASE_PROJECT_ID ||
            FALLBACK.firebaseProjectId,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK.firebaseAppId,
    },
};
