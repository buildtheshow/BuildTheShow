-- ══════════════════════════════════════════════════════════════
-- Build The Show — Ticketing Backend Tables
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Also add the ticketing_setup JSONB column for the questionnaire
ALTER TABLE productions ADD COLUMN IF NOT EXISTS ticketing_setup jsonb DEFAULT '{}';

-- ── Venues ──
CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  capacity int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Venue Layouts (versioned, never edit after tickets sold) ──
CREATE TABLE IF NOT EXISTS venue_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  version int DEFAULT 1,
  name text,
  stage_position text DEFAULT 'top',
  is_active boolean DEFAULT true,
  layout_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ── Sections ──
CREATE TABLE IF NOT EXISTS venue_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid REFERENCES venue_layouts(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  display_order int DEFAULT 0
);

-- ── Rows ──
CREATE TABLE IF NOT EXISTS venue_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES venue_sections(id) ON DELETE CASCADE,
  label text NOT NULL,
  display_order int DEFAULT 0
);

-- ── Seats ──
CREATE TABLE IF NOT EXISTS venue_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid REFERENCES venue_layouts(id) ON DELETE CASCADE,
  section_id uuid REFERENCES venue_sections(id) ON DELETE CASCADE,
  row_id uuid REFERENCES venue_rows(id) ON DELETE CASCADE,
  label text,
  seat_number int,
  seat_type text DEFAULT 'standard',
  accessible boolean DEFAULT false,
  companion boolean DEFAULT false,
  visible boolean DEFAULT true,
  default_price_tier text,
  x_position float,
  y_position float,
  rotation float DEFAULT 0,
  notes text
);

-- ── Performance Seat Inventory (live state per performance) ──
CREATE TABLE IF NOT EXISTS performance_seat_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL,
  seat_id uuid REFERENCES venue_seats(id) ON DELETE CASCADE,
  status text DEFAULT 'available',
  price_tier text,
  hold_id uuid,
  order_id uuid,
  ticket_id uuid,
  blocked_reason text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(performance_id, seat_id)
);

-- ── Seat Holds (check-on-read expiration) ──
CREATE TABLE IF NOT EXISTS seat_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL,
  seat_id uuid REFERENCES venue_seats(id) ON DELETE CASCADE,
  session_id text,
  customer_email text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(performance_id, seat_id)
);

-- ── Tickets (individual entitlements with QR) ──
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  production_id uuid NOT NULL,
  performance_id uuid NOT NULL,
  seat_id uuid REFERENCES venue_seats(id),
  ticket_type_id uuid,
  owner_name text,
  owner_email text,
  qr_code text UNIQUE,
  status text DEFAULT 'active',
  price_cents int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Scan Events (append-only check-in history) ──
CREATE TABLE IF NOT EXISTS scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  performance_id uuid NOT NULL,
  device text,
  result text DEFAULT 'admitted',
  scanned_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════════════════════

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_seat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

-- Public read access (needed for seat map display and ticket validation)
CREATE POLICY "Public read venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Public read layouts" ON venue_layouts FOR SELECT USING (true);
CREATE POLICY "Public read sections" ON venue_sections FOR SELECT USING (true);
CREATE POLICY "Public read rows" ON venue_rows FOR SELECT USING (true);
CREATE POLICY "Public read seats" ON venue_seats FOR SELECT USING (true);
CREATE POLICY "Public read inventory" ON performance_seat_inventory FOR SELECT USING (true);
CREATE POLICY "Public read holds" ON seat_holds FOR SELECT USING (true);
CREATE POLICY "Public insert holds" ON seat_holds FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete expired holds" ON seat_holds FOR DELETE USING (expires_at < now());
CREATE POLICY "Public read tickets" ON tickets FOR SELECT USING (true);
CREATE POLICY "Public insert scans" ON scan_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read scans" ON scan_events FOR SELECT USING (true);

-- Admin full access (org admin can manage all ticketing data)
CREATE POLICY "Admin manage venues" ON venues
  USING (organization_id IN (SELECT o.id FROM organizations o WHERE o.admin_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT o.id FROM organizations o WHERE o.admin_id = auth.uid()));
CREATE POLICY "Admin manage layouts" ON venue_layouts USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage sections" ON venue_sections USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage rows" ON venue_rows USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage seats" ON venue_seats USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage inventory" ON performance_seat_inventory USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage holds" ON seat_holds USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage tickets" ON tickets USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage scans" ON scan_events USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- Indexes
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_perf_seat_inv_perf ON performance_seat_inventory(performance_id);
CREATE INDEX IF NOT EXISTS idx_perf_seat_inv_status ON performance_seat_inventory(performance_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_holds_expires ON seat_holds(expires_at);
CREATE INDEX IF NOT EXISTS idx_seat_holds_perf ON seat_holds(performance_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_perf ON tickets(performance_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_scan_events_ticket ON scan_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_venue_seats_layout ON venue_seats(layout_id);
CREATE INDEX IF NOT EXISTS idx_venue_sections_layout ON venue_sections(layout_id);
CREATE INDEX IF NOT EXISTS idx_venue_rows_section ON venue_rows(section_id);
