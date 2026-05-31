ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS is_deadline boolean DEFAULT false;

UPDATE production_events
SET is_deadline = true
WHERE event_type = 'deadline'
  AND is_deadline IS DISTINCT FROM true;
