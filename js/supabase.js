/**
 * media.112 - Supabase Client Configuration
 */

const SUPABASE_URL = 'https://zmjwrgvuszwlehidyogp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptandyZ3Z1c3p3bGVoaWR5b2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDUwNDYsImV4cCI6MjA5ODU4MTA0Nn0.g41kw2ekmGuIIee9JIscDI7MnMr-Im5-W1nbXjmgcc0';

let db = null;

try {
    if (window.supabase && window.supabase.createClient) {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase connected');
    } else {
        console.error('Supabase SDK not loaded. Check CDN connection.');
    }
} catch (e) {
    console.error('Supabase init error:', e);
}
