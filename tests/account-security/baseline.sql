CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
-- Model the existing slug CHECK's unqualified helper dependency. The local
-- fixtures are ASCII; production's normalizer additionally removes accents.
CREATE FUNCTION public.normalize_slug_for_blocklist(p_slug text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(lower(coalesce(p_slug,'')),'[^a-z]','','g') $$;
CREATE FUNCTION public.is_blocked_organization_slug(p_slug text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT normalize_slug_for_blocklist(p_slug) ~ '(arsehole|asshole|bitch|blowjob|bullshit|chink|cock|cocksucker|cunt|faggot|^fag$|fuck|kike|motherfucker|nazi|nigg|paki|porn|pussy|rape|shit|slut|spic|twat|whore|wop)' $$;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, banned_until timestamptz, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth, public, storage TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TABLE public."organizations"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, "email" text, "location" text, "description" text, "admin_id" uuid, "created_at" timestamptz DEFAULT now(), "location_lat" numeric, "location_lng" numeric, "abbreviation" text, "banner_url" text, "custom_id" text, "website" text, "logo_url" text, "bio" text, "mission" text, "story" text, "profile_public" bool DEFAULT true, "show_contact" bool DEFAULT true, "established_year" int4, "total_productions_override" int4, "slug" text, "logo_white_url" text, "logo_black_url" text, "logo_alternative_url" text, "etransfer_email" text, "org_type" text, "legal_structure" text, "phone" text, "account_owner_type" text, "account_owner_name" text, "account_owner_role" text, "planning_calendar" jsonb DEFAULT '[]'::jsonb NOT NULL, "slug_changed_at" timestamptz, "payment_settings" jsonb DEFAULT '{}'::jsonb, "primary_venue_id" uuid, "board_structure" text, "org_roles" text[], "proposal_submission_token" text DEFAULT encode(gen_random_bytes(12), 'hex'::text));
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ADD CONSTRAINT model_slug_check CHECK (NOT public.is_blocked_organization_slug(slug));
GRANT ALL ON public."organizations" TO anon, authenticated;
CREATE TABLE public."org_members"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "org_id" uuid, "user_id" uuid, "role" text DEFAULT 'member'::text, "joined_at" timestamptz DEFAULT now(), "title" text, "access_level" text DEFAULT 'editor'::text, "display_name" text, "phone" text, "phone_number" text, "headshot_url" text, "custom_id" text);
ALTER TABLE public."org_members" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."org_members" TO anon, authenticated;
CREATE TABLE public."org_invitations"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "org_id" uuid, "email" text NOT NULL, "role" text DEFAULT 'member'::text, "token" text DEFAULT (gen_random_uuid())::text, "invited_by" uuid, "expires_at" timestamptz DEFAULT (now() + '7 days'::interval), "used_at" timestamptz, "created_at" timestamptz DEFAULT now(), "title" text, "access_level" text DEFAULT 'editor'::text);
ALTER TABLE public."org_invitations" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."org_invitations" TO anon, authenticated;
CREATE TABLE public."member_ids"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "display_id" text NOT NULL, "user_id" uuid, "created_at" timestamptz DEFAULT now());
ALTER TABLE public."member_ids" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."member_ids" TO anon, authenticated;
CREATE TABLE public."profiles"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "account_id" uuid, "suffix_id" text, "name" text, "age" int4, "pronouns" text, "bio" text, "location" text, "credit_name" text, "headshot_url" text, "guardian_name" text, "guardian_email" text, "guardian_phone" text, "nickname" text, "legal_first_name" text, "legal_last_name" text, "date_of_birth" date, "user_id" uuid, "member_display_id" text, "profile_display_id" text, "created_at" timestamptz DEFAULT now(), "headshot_urls" text[] DEFAULT '{}'::text[], "sections" jsonb DEFAULT '{}'::jsonb, "deleted_at" timestamptz, "email" text, "custom_id" text);
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."profiles" TO anon, authenticated;
CREATE TABLE public."productions"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "organization_id" uuid, "title" text NOT NULL, "description" text, "status" text DEFAULT 'draft'::text, "created_at" timestamptz DEFAULT now(), "custom_id" text, "subtitle" text, "season_year" text, "venue" text, "start_date" date, "end_date" date, "image_url" text, "production_type" text DEFAULT 'musical'::text, "is_public" bool DEFAULT true, "wizard_data" jsonb DEFAULT '{}'::jsonb, "poster_url" text, "page_status" text DEFAULT 'draft'::text, "slug" text, "enabled_modules" jsonb DEFAULT '{}'::jsonb, "age_min" int4, "age_max" int4, "audition_location" text, "rehearsal_location" text, "performance_location" text, "holiday_country" text, "holiday_region" text, "audition_locations" jsonb DEFAULT '[]'::jsonb, "rehearsal_locations" jsonb DEFAULT '[]'::jsonb, "performance_locations" jsonb DEFAULT '[]'::jsonb, "registration_settings" jsonb DEFAULT '{}'::jsonb, "registration_households" jsonb DEFAULT '[]'::jsonb, "volunteer_staffing_plan" jsonb DEFAULT '{}'::jsonb, "ticketing_setup" jsonb DEFAULT '{}'::jsonb, "dismissed_team_roles" text[] DEFAULT '{}'::text[], "budget_revenue_drivers" jsonb, "production_support_list" jsonb DEFAULT '[]'::jsonb NOT NULL, "production_support_ordered" bool DEFAULT false NOT NULL);
ALTER TABLE public."productions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."productions" TO anon, authenticated;
CREATE TABLE public."audition_applications"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "production_id" uuid, "user_id" uuid, "name" text NOT NULL, "email" text, "phone" text, "notes" text, "headshot_url" text, "role_interest" text, "status" text DEFAULT 'pending'::text, "created_at" timestamptz DEFAULT now(), "slot_id" uuid, "experience" text, "conflicts" text, "skills" text, "file_url" text, "org_notes" text, "character_id" uuid, "profile_id" uuid, "session_id" uuid, "time_slot_id" uuid, "checked_in" bool DEFAULT false, "checked_in_at" timestamptz, "experience_level" text, "avail_rehearsals" bool, "avail_performances" bool, "shirt_size" text, "pant_size" text, "dress_size" text, "hair_length" text, "date_conflicts" jsonb DEFAULT '{}'::jsonb, "custom_answers" jsonb DEFAULT '{}'::jsonb, "callback_status" text DEFAULT 'none'::text, "callback_notes" text, "callback_rating" jsonb DEFAULT '{}'::jsonb, "callback_group_id" uuid, "slot_assignments" jsonb DEFAULT '[]'::jsonb, "session_checkins" jsonb DEFAULT '[]'::jsonb, "audition_type_1" uuid, "audition_slot_1" uuid, "audition_type_2" uuid, "audition_slot_2" uuid, "audition_type_3" uuid, "audition_slot_3" uuid, "audition_type_4" uuid, "audition_slot_4" uuid, "audition_type_5" uuid, "audition_slot_5" uuid, "audition_type_6" uuid, "audition_slot_6" uuid, "audition_type_7" uuid, "audition_slot_7" uuid, "audition_type_8" uuid, "audition_slot_8" uuid, "audition_type_9" uuid, "audition_slot_9" uuid, "audition_type_10" uuid, "audition_slot_10" uuid, "attendance_mode" text, "audition_method" text DEFAULT 'in_person'::text, "preferred_name" text, "pronouns" text, "booking_id" uuid);
ALTER TABLE public."audition_applications" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."audition_applications" TO anon, authenticated;
CREATE TABLE public."production_team_members"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "production_id" uuid NOT NULL, "name" text NOT NULL, "email" text, "role" text NOT NULL, "passcode" text NOT NULL, "is_active" bool DEFAULT true NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL, "note_color" text DEFAULT '#572e88'::text NOT NULL, "invite_sent_at" timestamptz, "bio" text, "headshot_url" text, "headshot_path" text, "phone" text, "department" text, "access_level" text DEFAULT 'creative'::text, "menu_access" jsonb DEFAULT '[]'::jsonb, "portal_token" uuid DEFAULT gen_random_uuid());
ALTER TABLE public."production_team_members" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_team_members" TO anon, authenticated;
CREATE TABLE public."production_permission_pages"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "page_key" text NOT NULL, "parent_page_key" text, "label" text NOT NULL, "sort_order" int4 DEFAULT 0 NOT NULL, "is_active" bool DEFAULT true NOT NULL);
ALTER TABLE public."production_permission_pages" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_permission_pages" TO anon, authenticated;
CREATE TABLE public."production_team_member_page_permissions"("id" uuid DEFAULT gen_random_uuid() NOT NULL, "production_id" uuid NOT NULL, "team_member_id" uuid NOT NULL, "page_key" text NOT NULL, "access_level" text DEFAULT 'none'::text NOT NULL, "granted_by" uuid, "updated_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_team_member_page_permissions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_team_member_page_permissions" TO anon, authenticated;
ALTER TABLE public."audition_applications" ADD CONSTRAINT "audition_applications_pkey" PRIMARY KEY (id);
ALTER TABLE public."member_ids" ADD CONSTRAINT "member_ids_display_id_key" UNIQUE (display_id);
ALTER TABLE public."member_ids" ADD CONSTRAINT "member_ids_pkey" PRIMARY KEY (id);
ALTER TABLE public."org_invitations" ADD CONSTRAINT "org_invitations_pkey" PRIMARY KEY (id);
ALTER TABLE public."org_invitations" ADD CONSTRAINT "org_invitations_token_key" UNIQUE (token);
ALTER TABLE public."org_members" ADD CONSTRAINT "org_members_org_id_user_id_key" UNIQUE (org_id, user_id);
ALTER TABLE public."org_members" ADD CONSTRAINT "org_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_custom_id_key" UNIQUE (custom_id);
ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_team_members" ADD CONSTRAINT "production_team_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."productions" ADD CONSTRAINT "productions_custom_id_key" UNIQUE (custom_id);
ALTER TABLE public."productions" ADD CONSTRAINT "productions_pkey" PRIMARY KEY (id);
ALTER TABLE public."productions" ADD CONSTRAINT "productions_slug_key" UNIQUE (slug);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."audition_applications" ADD CONSTRAINT "audition_applications_production_id_fkey" FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE;
ALTER TABLE public."audition_applications" ADD CONSTRAINT "audition_applications_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."audition_applications" ADD CONSTRAINT "audition_applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."member_ids" ADD CONSTRAINT "member_ids_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public."org_invitations" ADD CONSTRAINT "org_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public."org_invitations" ADD CONSTRAINT "org_invitations_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public."org_members" ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public."org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."production_team_members" ADD CONSTRAINT "production_team_members_production_id_fkey" FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE;
ALTER TABLE public."productions" ADD CONSTRAINT "productions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_account_id_fkey" FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public."production_permission_pages" ADD CONSTRAINT "production_permission_pages_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_permission_pages" ADD CONSTRAINT "production_permission_pages_page_key_key" UNIQUE (page_key);
ALTER TABLE public."production_team_member_page_permissions" ADD CONSTRAINT "production_team_member_page_permissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_team_member_page_permissions" ADD CONSTRAINT "production_team_member_page_p_production_id_team_member_id__key" UNIQUE (production_id, team_member_id, page_key);
ALTER TABLE public."production_team_member_page_permissions" ADD CONSTRAINT "production_team_member_page_permissions_production_id_fkey" FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE;
ALTER TABLE public."production_team_member_page_permissions" ADD CONSTRAINT "production_team_member_page_permissions_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES production_team_members(id) ON DELETE CASCADE;
ALTER TABLE public."production_team_member_page_permissions" ADD CONSTRAINT "production_team_member_page_permissions_page_key_fkey" FOREIGN KEY (page_key) REFERENCES production_permission_pages(page_key) ON DELETE CASCADE;
CREATE POLICY "Production permission pages are readable" ON public."production_permission_pages" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Org admin can manage production page permissions" ON public."production_team_member_page_permissions" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_team_member_page_permissions.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_team_member_page_permissions.production_id) AND (o.admin_id = auth.uid())))));
CREATE POLICY "Org admin can manage production team members" ON public."production_team_members" AS PERMISSIVE FOR ALL TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admin can manage team members" ON public."production_team_members" AS PERMISSIVE FOR ALL TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org can manage production team members" ON public."production_team_members" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_team_members.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_team_members.production_id) AND (o.admin_id = auth.uid())))));
CREATE POLICY "Anyone can submit application" ON public."audition_applications" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY "Org admin can read audition applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admin can update applications" ON public."audition_applications" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admin can update audition applications" ON public."audition_applications" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admin can view applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admins manage applications" ON public."audition_applications" AS PERMISSIVE FOR ALL TO PUBLIC USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Public can insert audition applications" ON public."audition_applications" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY "Public can read audition applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Public can read audition applications for portal" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Public can submit audition application" ON public."audition_applications" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY "User can view own applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "Users can view their own applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "Users can withdraw their own applications" ON public."audition_applications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users view own applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "team_portal_insert_applications" ON public."audition_applications" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (true);
CREATE POLICY "team_portal_read_applications" ON public."audition_applications" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "team_portal_update_applications" ON public."audition_applications" AS PERMISSIVE FOR UPDATE TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "team_portal_write_applications" ON public."audition_applications" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert their own member ID" ON public."member_ids" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can read their own member ID" ON public."member_ids" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "Members can view their own memberships" ON public."org_members" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "Org admins manage members" ON public."org_members" AS PERMISSIVE FOR ALL TO PUBLIC USING ((org_id IN ( SELECT organizations.id
   FROM organizations
  WHERE (organizations.admin_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organizations.id
   FROM organizations
  WHERE (organizations.admin_id = auth.uid()))));
CREATE POLICY "Public can read org members" ON public."org_members" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Anyone can read invitation by token" ON public."org_invitations" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Org admins manage invitations" ON public."org_invitations" AS PERMISSIVE FOR ALL TO PUBLIC USING ((org_id IN ( SELECT organizations.id
   FROM organizations
  WHERE (organizations.admin_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organizations.id
   FROM organizations
  WHERE (organizations.admin_id = auth.uid()))));
CREATE POLICY "Profiles owned by user" ON public."profiles" AS PERMISSIVE FOR ALL TO PUBLIC USING ((account_id = auth.uid()));
CREATE POLICY "Users can insert their own profile" ON public."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can read their own profile" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "Users can update their own profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Anyone can view productions" ON public."productions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Org admin manages productions" ON public."productions" AS PERMISSIVE FOR ALL TO PUBLIC USING ((organization_id IN ( SELECT organizations.id
   FROM organizations
  WHERE (organizations.admin_id = auth.uid()))));
CREATE POLICY "Public can read live productions" ON public."productions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((page_status = 'live'::text));
CREATE POLICY "public can view productions" ON public."productions" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "Anyone can view orgs" ON public."organizations" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Org admin full access" ON public."organizations" AS PERMISSIVE FOR ALL TO PUBLIC USING ((admin_id = auth.uid()));
CREATE POLICY "public can view organizations" ON public."organizations" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE TABLE storage.buckets(id text PRIMARY KEY, public boolean);
INSERT INTO storage.buckets VALUES ('profile-headshots',true);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON storage.objects FOR SELECT USING(bucket_id='profile-headshots');
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
