-- ============================================
-- CT Tracker - Supabase Database Setup
-- ============================================
-- Run this in the Supabase SQL Editor to create
-- the tables needed for the tracking system.
-- ============================================

-- Table: clicks
-- Stores every redirect click from ads
CREATE TABLE IF NOT EXISTS clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_slug TEXT NOT NULL,
  event_name TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  device TEXT DEFAULT 'unknown',
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  fbclid TEXT,
  fb_ad_id TEXT,
  fb_adset_id TEXT,
  fb_campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_clicks_event_slug ON clicks(event_slug);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_utm_source ON clicks(utm_source);
CREATE INDEX IF NOT EXISTS idx_clicks_device ON clicks(device);

-- Table: custom_events
-- Stores custom tracking events (button clicks, page views, etc.)
CREATE TABLE IF NOT EXISTS custom_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_slug TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'custom',
  metadata JSONB DEFAULT '{}',
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_events_slug ON custom_events(event_slug);
CREATE INDEX IF NOT EXISTS idx_custom_events_type ON custom_events(event_type);

-- ============================================
-- Quick verification query (run after setup)
-- ============================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public';
