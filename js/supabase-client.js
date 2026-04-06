// js/supabase-client.js

const rawSupabaseUrl = 'https://thetdckuftpzyubvlbju.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZXRkY2t1ZnRwenl1YnZsYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3Nzk2NzgsImV4cCI6MjA3ODM1NTY3OH0.79TyhVbyQzKa9xFeg9JxVLxcN0NVyYBx-_VniQFfQZg';
const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');

window.__SUPABASE_CONFIG = {
  url: supabaseUrl,
  anonKey: supabaseKey
};

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  console.error('[Supabase] Invalid URL format. Expected https://<project-ref>.supabase.co');
}

if (!supabaseKey || supabaseKey.length < 100) {
  console.error('[Supabase] Anon key is missing or malformed.');
}

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('[Supabase] CDN library not loaded. window.supabase.createClient is unavailable.');
} else {
  const { createClient } = window.supabase;
  const sessionStorageAdapter = {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: (key) => window.sessionStorage.removeItem(key)
  };

  window.supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: sessionStorageAdapter,
      autoRefreshToken: false,
      persistSession: true
    },
    global: {
      fetch: (...args) => {
        const request = args[0];
        const url = request instanceof Request ? request.url : String(request);
        console.info('[SupabaseFetch] Request:', url);
        return fetch(...args)
          .then((response) => {
            console.info('[SupabaseFetch] Response:', {
              url,
              status: response.status,
              ok: response.ok
            });
            return response;
          })
          .catch((error) => {
            console.error('[SupabaseFetch] Failed:', { url, error });
            throw error;
          });
      }
    }
  });

  console.info('[Supabase] Client initialized successfully.', { url: supabaseUrl });
}
