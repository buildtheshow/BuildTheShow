CREATE TABLE public."audition_slots"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"date" date NOT NULL,"start_time" time NOT NULL,"end_time" time NOT NULL,"capacity" int4 DEFAULT 1 NOT NULL,"created_at" timestamptz DEFAULT now());
ALTER TABLE public."audition_slots" ADD PRIMARY KEY(id);
CREATE TABLE public."audition_time_slots"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"session_id" uuid,"slot_time" time NOT NULL,"slot_date" date,"label" text,"is_available" bool DEFAULT true,"booked_profile_id" uuid,"created_at" timestamptz DEFAULT now(),"block_id" text,"capacity" int4 DEFAULT 1,"reserved_until" timestamptz,"reserved_token" text,"hold_expires_at" timestamptz,"hold_session_id" text);
ALTER TABLE public."audition_time_slots" ADD PRIMARY KEY(id);
CREATE TABLE public."audition_configs"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"is_open" bool DEFAULT false,"audition_date" date,"audition_location" text,"instructions" text,"collect_headshot" bool DEFAULT true,"collect_resume" bool DEFAULT false,"collect_song" bool DEFAULT false,"collect_monologue" bool DEFAULT false,"collect_role" bool DEFAULT true,"collect_notes" bool DEFAULT true,"created_at" timestamptz DEFAULT now(),"collect_experience" bool DEFAULT false,"collect_conflicts" bool DEFAULT false,"collect_skills" bool DEFAULT false,"collect_file_upload" bool DEFAULT false,"session_types" jsonb DEFAULT '{}'::jsonb,"char_display_fields" jsonb DEFAULT '{}'::jsonb,"about_text" text,"fees_info" text,"has_fee" bool,"faq" jsonb DEFAULT '[]'::jsonb,"expectations_text" text,"prepare_text" text,"expect_text" text,"section_actor" bool DEFAULT true,"section_guardian" bool DEFAULT true,"section_physical" bool DEFAULT true,"section_experience" bool DEFAULT true,"section_roles" bool DEFAULT true,"section_conflicts" bool DEFAULT true,"section_headshot" bool DEFAULT true,"section_acting" bool DEFAULT true,"section_vocal" bool DEFAULT true,"section_dance" bool DEFAULT true,"section_special_skills" bool DEFAULT true,"section_previous_experience" bool DEFAULT true);
ALTER TABLE public."audition_configs" ADD PRIMARY KEY(id);
ALTER TABLE public."audition_slots" ENABLE ROW LEVEL SECURITY; GRANT ALL ON public."audition_slots" TO anon,authenticated;
ALTER TABLE public."audition_time_slots" ENABLE ROW LEVEL SECURITY; GRANT ALL ON public."audition_time_slots" TO anon,authenticated;
ALTER TABLE public."audition_configs" ENABLE ROW LEVEL SECURITY; GRANT ALL ON public."audition_configs" TO anon,authenticated;
CREATE POLICY "Org admin can manage audition sessions" ON public."audition_sessions" AS PERMISSIVE FOR ALL TO public USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Public can read visible audition sessions" ON public."audition_sessions" AS PERMISSIVE FOR SELECT TO public USING (((enabled = true) AND (show_to_applicants = true)));
CREATE POLICY "team_portal_read_sessions" ON public."audition_sessions" AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Org admin can manage audition time slots" ON public."audition_time_slots" AS PERMISSIVE FOR ALL TO public USING ((session_id IN ( SELECT s.id
   FROM ((audition_sessions s
     JOIN productions p ON ((p.id = s.production_id)))
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((session_id IN ( SELECT s.id
   FROM ((audition_sessions s
     JOIN productions p ON ((p.id = s.production_id)))
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Public can mark slot unavailable" ON public."audition_time_slots" AS PERMISSIVE FOR UPDATE TO public USING ((is_available = true)) WITH CHECK ((is_available = false));
CREATE POLICY "Public can read all time slots" ON public."audition_time_slots" AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Public can reserve slot" ON public."audition_time_slots" AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public can update slot holds" ON public."audition_time_slots" AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "team_portal_read_slots" ON public."audition_time_slots" AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Org admins manage audition configs" ON public."audition_configs" AS PERMISSIVE FOR ALL TO public USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Public can read open audition configs" ON public."audition_configs" AS PERMISSIVE FOR SELECT TO public USING ((is_open = true));
CREATE POLICY "Public can read open configs" ON public."audition_configs" AS PERMISSIVE FOR SELECT TO public USING ((is_open = true));
CREATE POLICY "Anyone can view slots" ON public."audition_slots" AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Org admin can manage slots" ON public."audition_slots" AS PERMISSIVE FOR ALL TO public USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));

CREATE POLICY "Anyone can book" ON public."audition_bookings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Org admin can read audition bookings" ON public."audition_bookings" AS PERMISSIVE FOR ALL TO public USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admin can read bookings" ON public."audition_bookings" AS PERMISSIVE FOR SELECT TO public USING ((session_id IN ( SELECT s.id
   FROM ((audition_sessions s
     JOIN productions p ON ((p.id = s.production_id)))
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Public can insert audition bookings" ON public."audition_bookings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read audition bookings" ON public."audition_bookings" AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Public can read audition bookings for portal" ON public."audition_bookings" AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "team_portal_read_bookings" ON public."audition_bookings" AS PERMISSIVE FOR SELECT TO anon USING (true);
