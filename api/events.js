/**
 * CT Tracker - Events API
 *
 * Route: GET /api/events
 *
 * Returns list of configured events with their click counts.
 * Used by the Angular dashboard to display all events.
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Same event config as go.js - in production, move to a shared config
const EVENTS = {
  'summer-vibes': {
    name: 'Summer Vibes Afro - Halle W',
    destination: 'https://eventfrog.ch/fr/p/soirees-fetes/soiree-a-theme/summer-vibes-afro-halle-w-7465431493805902516.html',
    date: '2026-06-05',
  },
};

module.exports = async function handler(req, res) {
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.STATS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();

  const eventsWithStats = await Promise.all(
    Object.entries(EVENTS).map(async ([slug, event]) => {
      let totalClicks = 0;
      let uniqueVisitors = 0;

      if (supabase) {
        try {
          const { count } = await supabase
            .from('clicks')
            .select('*', { count: 'exact', head: true })
            .eq('event_slug', slug);
          totalClicks = count || 0;

          const { data } = await supabase
            .from('clicks')
            .select('ip_hash')
            .eq('event_slug', slug);
          uniqueVisitors = new Set((data || []).map(d => d.ip_hash)).size;
        } catch (err) {
          console.error(`Stats error for ${slug}:`, err.message);
        }
      }

      return {
        slug,
        ...event,
        tracking_url: `https://hm-events.ch/go/${slug}`,
        total_clicks: totalClicks,
        unique_visitors: uniqueVisitors,
      };
    })
  );

  res.status(200).json({ events: eventsWithStats });
};
