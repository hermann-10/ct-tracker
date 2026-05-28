/**
 * CT Tracker - Redirect & Track API
 *
 * Route: GET /go/:slug (rewritten to /api/go?slug=:slug)
 *
 * Flow:
 * 1. User clicks ad on Instagram/Facebook
 * 2. Lands on hm-events.ch/go/summer-vibes
 * 3. This function:
 *    a) Records the click in Supabase
 *    b) Sends server-side event to Meta Conversions API
 *    c) Serves a tiny HTML page with Meta Pixel (client-side backup)
 *    d) Auto-redirects to Eventfrog in < 1 second
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Event configurations - add your events here
const EVENTS = {
  'summer-vibes': {
    name: 'Summer Vibes Afro - Halle W',
    destination: 'https://eventfrog.ch/fr/p/soirees-fetes/soiree-a-theme/summer-vibes-afro-halle-w-7465431493805902516.html',
    date: '2026-06-05',
  },
  // Add more events as needed:
  // 'next-event': {
  //   name: 'Next Event Name',
  //   destination: 'https://eventfrog.ch/...',
  //   date: '2026-07-XX',
  // },
};

// Initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Hash IP for privacy (we don't store raw IPs)
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'ct-tracker')).digest('hex').substring(0, 16);
}

// Parse UTM and Meta params from query string
function parseTrackingParams(query) {
  return {
    utm_source: query.utm_source || null,
    utm_medium: query.utm_medium || null,
    utm_campaign: query.utm_campaign || null,
    utm_content: query.utm_content || null,
    utm_term: query.utm_term || null,
    fbclid: query.fbclid || null,
    fb_ad_id: query.fb_ad_id || null,
    fb_adset_id: query.fb_adset_id || null,
    fb_campaign_id: query.fb_campaign_id || null,
  };
}

// Send server-side event to Meta Conversions API
async function sendMetaEvent(eventData, fbclid, userAgent, ip) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) return;

  const fetch = require('node-fetch');
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = {
    data: [{
      event_name: 'ViewContent',
      event_time: timestamp,
      event_source_url: `https://hm-events.ch/go/${eventData.slug}`,
      action_source: 'website',
      user_data: {
        client_ip_address: ip,
        client_user_agent: userAgent,
        fbc: fbclid ? `fb.1.${timestamp}.${fbclid}` : undefined,
      },
      custom_data: {
        content_name: eventData.name,
        content_category: 'Event',
        content_type: 'product',
      },
    }],
  };

  try {
    await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  } catch (err) {
    console.error('Meta Conversions API error:', err.message);
  }
}

// Record click in Supabase
async function recordClick(supabase, data) {
  if (!supabase) return;

  try {
    await supabase.from('clicks').insert({
      event_slug: data.slug,
      event_name: data.name,
      ip_hash: data.ipHash,
      user_agent: data.userAgent,
      device: data.device,
      referrer: data.referrer,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
      fbclid: data.fbclid,
      fb_ad_id: data.fb_ad_id,
      fb_adset_id: data.fb_adset_id,
      fb_campaign_id: data.fb_campaign_id,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Supabase insert error:', err.message);
  }
}

// Detect device type from user agent
function detectDevice(ua) {
  if (!ua) return 'unknown';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

// Build redirect URL with UTM params preserved
function buildRedirectUrl(destination, query) {
  const url = new URL(destination);
  // Pass through UTM params to Eventfrog
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
    if (query[param]) url.searchParams.set(param, query[param]);
  });
  // Add default UTMs if not present
  if (!query.utm_source) url.searchParams.set('utm_source', 'meta');
  if (!query.utm_medium) url.searchParams.set('utm_medium', 'paid');
  return url.toString();
}

module.exports = async function handler(req, res) {
  const slug = req.query.slug;

  // Look up event
  const event = EVENTS[slug];
  if (!event) {
    res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>Event not found</title></head>
      <body style="font-family:Arial;text-align:center;padding:50px;">
        <h1>Event not found</h1>
        <p>Visit <a href="https://hm-events.ch">hm-events.ch</a> for upcoming events.</p>
      </body></html>
    `);
    return;
  }

  // Extract tracking data
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '0.0.0.0';
  const userAgent = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || '';
  const params = parseTrackingParams(req.query);

  // Record click async (don't block redirect)
  const supabase = getSupabase();
  const clickData = {
    slug,
    name: event.name,
    ipHash: hashIP(ip),
    userAgent: userAgent.substring(0, 500),
    device: detectDevice(userAgent),
    referrer: referrer.substring(0, 500),
    ...params,
  };

  // Fire and forget - don't wait for DB or Meta API
  recordClick(supabase, clickData);
  sendMetaEvent({ slug, name: event.name }, params.fbclid, userAgent, ip);

  // Build redirect URL
  const redirectUrl = buildRedirectUrl(event.destination, req.query);
  const pixelId = process.env.META_PIXEL_ID || 'YOUR_PIXEL_ID';

  // Serve tracking page with Meta Pixel + auto-redirect
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${event.name} - Billetterie</title>

      <!-- Meta Pixel Code -->
      <script>
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
        fbq('track', 'ViewContent', {
          content_name: '${event.name}',
          content_category: 'Event',
          content_type: 'product'
        });
      </script>
      <noscript>
        <img height="1" width="1" style="display:none"
          src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>
      </noscript>
      <!-- End Meta Pixel Code -->

      <!-- Auto-redirect after pixel fires -->
      <meta http-equiv="refresh" content="1;url=${redirectUrl}">

      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          background: #0a0a0a;
          color: #ffffff;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1.5rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { font-size: 1.2rem; font-weight: 500; margin-bottom: 0.5rem; }
        p { font-size: 0.9rem; color: #888; }
        a { color: #6366f1; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h2>Redirection vers la billetterie...</h2>
        <p>Si rien ne se passe, <a href="${redirectUrl}">cliquez ici</a></p>
      </div>

      <script>
        // Redirect after a short delay to let the pixel fire
        setTimeout(function() {
          window.location.href = '${redirectUrl}';
        }, 800);
      </script>
    </body>
    </html>
  `);
};
