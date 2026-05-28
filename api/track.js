/**
 * CT Tracker - Client-side Track API
 *
 * Route: POST /api/track
 *
 * Receives tracking events from the client-side pixel page
 * as a backup to the server-side tracking in go.js.
 * Also used for custom events (e.g., button clicks on landing pages).
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ ok: true }); // Fail silently
  }

  try {
    const { event_slug, event_type, metadata } = req.body;

    await supabase.from('custom_events').insert({
      event_slug: event_slug || 'unknown',
      event_type: event_type || 'custom',
      metadata: metadata || {},
      user_agent: (req.headers['user-agent'] || '').substring(0, 500),
      created_at: new Date().toISOString(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Track error:', err.message);
    res.status(200).json({ ok: true }); // Always return 200 for tracking
  }
};
