INSERT INTO production_permission_pages (page_key, parent_page_key, label, sort_order, is_active)
VALUES
  ('production_calendar', null, 'Production Calendar', 30, true),
  ('registration.dashboard', 'registration', 'Registration Dashboard', 120, true),
  ('registration.publicview', 'registration', 'Registration Form', 130, true),
  ('registration.payments', 'registration', 'Registration Status', 140, true),
  ('registration.settings', 'registration', 'Registration Settings', 150, true),
  ('marketing.dashboard', 'marketing', 'Marketing Dashboard', 160, true),
  ('marketing.sponsors', 'marketing', 'Sponsors', 170, true),
  ('marketing.assets', 'marketing', 'Marketing Assets', 180, true),
  ('marketing.programme', 'marketing', 'Programme', 190, true),
  ('marketing.media', 'marketing', 'Media', 200, true),
  ('marketing.calendar', 'marketing', 'Marketing Calendar', 210, true),
  ('marketing.tasks', 'marketing', 'Marketing Tasks', 220, true),
  ('budget.dashboard', 'budget', 'Budget Dashboard', 230, true),
  ('budget.breakdown', 'budget', 'Budget Breakdown', 240, true),
  ('budget.receipts', 'budget', 'Receipts', 250, true),
  ('budget.collect', 'budget', 'Collect', 260, true),
  ('email_templates', null, 'Email Templates', 270, true),
  ('template_test', null, 'Template Test', 280, true),
  ('settings.details', 'settings', 'Settings', 290, true)
ON CONFLICT (page_key) DO UPDATE
SET parent_page_key = EXCLUDED.parent_page_key,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;
