INSERT INTO production_permission_pages (page_key, parent_page_key, label, sort_order, is_active)
VALUES
  ('volunteers', null, 'Volunteers', 25, true)
ON CONFLICT (page_key) DO UPDATE
SET parent_page_key = EXCLUDED.parent_page_key,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;
