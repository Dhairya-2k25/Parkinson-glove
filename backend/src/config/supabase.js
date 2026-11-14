let createClient = null;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {}

try { require('dotenv').config(); } catch (e) {}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';

// Admin client — uses service role key, NEVER exposed to frontend
const supabaseAdmin = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Public client — uses anon key
const supabasePublic = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

module.exports = { supabaseAdmin, supabasePublic };
