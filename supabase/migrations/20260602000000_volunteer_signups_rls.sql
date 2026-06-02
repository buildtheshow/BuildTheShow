-- volunteer_signups RLS policies
-- Public INSERT: anyone can submit a volunteer request from the public page
-- Public SELECT: public page needs to count signups; portal needs to show volunteer their own
-- Org admin full access: approve, decline, update hours, delete

ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert volunteer signups" ON public.volunteer_signups;
CREATE POLICY "Public can insert volunteer signups" ON public.volunteer_signups
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read volunteer signups" ON public.volunteer_signups;
CREATE POLICY "Public can read volunteer signups" ON public.volunteer_signups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Org admin can manage volunteer signups" ON public.volunteer_signups;
CREATE POLICY "Org admin can manage volunteer signups" ON public.volunteer_signups
  USING (production_id IN (
    SELECT p.id FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE o.admin_id = auth.uid()
  ))
  WITH CHECK (production_id IN (
    SELECT p.id FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE o.admin_id = auth.uid()
  ));
