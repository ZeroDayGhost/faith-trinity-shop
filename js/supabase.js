const SUPABASE_URL = 'https://soegtzebadtvggumviae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Le2QwE7vSAfY-JqwXo3wJg_TPWWKaC-';

export const APP_CONFIG = {
    shopName: 'Faith Trinity Shop',
    currencySymbol: 'KSh',
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
};

export function isSupabaseConfigured() {
    return (
        APP_CONFIG.supabaseUrl.startsWith('https://') &&
        !APP_CONFIG.supabaseUrl.includes('YOUR-PROJECT-REF') &&
        APP_CONFIG.supabaseAnonKey !== 'YOUR-SUPABASE-ANON-KEY'
    );
}

export function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
        return null;
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('Supabase JavaScript library could not be loaded.');
    }

    if (!window.faithTrinitySupabase) {
        window.faithTrinitySupabase = window.supabase.createClient(
            APP_CONFIG.supabaseUrl,
            APP_CONFIG.supabaseAnonKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                },
            }
        );
    }

    return window.faithTrinitySupabase;
}

export function createDetachedSupabaseClient() {
    if (!isSupabaseConfigured()) {
        return null;
    }

    return window.supabase.createClient(
        APP_CONFIG.supabaseUrl,
        APP_CONFIG.supabaseAnonKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
    );
}
