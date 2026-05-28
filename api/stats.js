/**
 * CT Tracker - Stats API
 *
 * Route: GET /api/stats?slug=summer-vibes&from=2026-05-28&to=2026-06-05
 *
 * Returns click statistics for a given event.
 * This will be consumed by the Angular dashboard later.
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

module.exports = async function handler(req, res) {
  // Simple auth check (replace with proper auth later)
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.STATS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { slug, from, to } = req.query;

  try {
    // Base query
    let query = supabase
      .from('clicks')
      .select('*', { count: 'exact' });

    if (slug) query = query.eq('event_slug', slug);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59Z');

    query = query.order('created_at', { ascending: false }).limit(1000);

    const { data: clicks, count, error } = await query;

    if (error) throw error;

    // Compute aggregated stats
    const stats = {
      total_clicks: count,
      clicks_by_device: {},
      clicks_by_source: {},
      clicks_by_hour: {},
      clicks_by_day: {},
      unique_visitors: new Set(),
    };

    clicks.forEach(click => {
      // By device
      const device = click.device || 'unknown';
      stats.clicks_by_device[device] = (stats.clicks_by_device[device] || 0) + 1;

      // By source
      const source = click.utm_source || 'direct';
      stats.clicks_by_source[source] = (stats.clicks_by_source[source] || 0) + 1;

      // By hour
      const hour = new Date(click.created_at).getHours();
      stats.clicks_by_hour[hour] = (stats.clicks_by_hour[hour] || 0) + 1;

      // By day
      const day = click.created_at.substring(0, 10);
      stats.clicks_by_day[day] = (stats.clicks_by_day[day] || 0) + 1;

      // Unique visitors
      stats.unique_visitors.add(click.ip_hash);
    });

    res.status(200).json({
      event_slug: slug || 'all',
      period: { from: from || 'all', to: to || 'all' },
      total_clicks: count,
      unique_visitors: stats.unique_visitors.size,
      clicks_by_device: stats.clicks_by_device,
      clicks_by_source: stats.clicks_by_source,
      clicks_by_hour: stats.clicks_by_hour,
      clicks_by_day: stats.clicks_by_day,
      recent_clicks: clicks.slice(0, 20).map(c => ({
        timestamp: c.created_at,
        device: c.device,
        source: c.utm_source,
        campaign: c.utm_campaign,
      })),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
