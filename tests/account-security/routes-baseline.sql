CREATE TABLE public.budget_categories("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"type" text NOT NULL,"planned_cents" integer DEFAULT 0,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),"color" text DEFAULT '#572e88'::text,"department_key" text,PRIMARY KEY(id));
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.budget_categories TO anon,authenticated;
CREATE TABLE public.household_payment_logs("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"household_id" text NOT NULL,"amount_cents" integer DEFAULT 0 NOT NULL,"payment_method" text,"paid_at" timestamp with time zone DEFAULT now(),"paid_by" text,"transaction_ref" text,"payment_notes" text,"installment_index" integer,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.household_payment_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.household_payment_logs TO anon,authenticated;
CREATE TABLE public.budget_receipts("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"category_id" uuid,"vendor" text,"description" text,"amount_cents" integer DEFAULT 0,"receipt_date" date,"submitted_by_name" text,"submitted_by_email" text,"status" text DEFAULT 'pending'::text,"notes" text,"collect_token" text,"created_at" timestamp with time zone DEFAULT now(),"paid_by" text,"subtotal_cents" integer,"tax_cents" integer,"receipt_url" text,"department" text,"submitted_by" text,"submitted_by_id" uuid,"line_items" jsonb,PRIMARY KEY(id));
ALTER TABLE public.budget_receipts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.budget_receipts TO anon,authenticated;
CREATE TABLE public.ticket_types("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"name" text NOT NULL,"description" text DEFAULT ''::text,"price_cents" integer DEFAULT 0 NOT NULL,"currency" text DEFAULT 'CAD'::text NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ticket_types TO anon,authenticated;
CREATE TABLE public.organization_planning_events("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid NOT NULL,"title" text NOT NULL,"start_at" text NOT NULL,"end_at" text,"all_day" boolean DEFAULT true NOT NULL,"notes" text DEFAULT ''::text NOT NULL,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"category" text DEFAULT 'other'::text NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.organization_planning_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.organization_planning_events TO anon,authenticated;
CREATE TABLE public.ticket_orders("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"performance_event_id" uuid,"first_name" text NOT NULL,"last_name" text NOT NULL,"email" text NOT NULL,"phone" text,"items" jsonb DEFAULT '[]'::jsonb NOT NULL,"total_cents" integer DEFAULT 0 NOT NULL,"currency" text DEFAULT 'CAD'::text NOT NULL,"payment_status" text DEFAULT 'pending'::text NOT NULL,"status" text DEFAULT 'confirmed'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ticket_orders TO anon,authenticated;
CREATE TABLE public.budget_settings("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"collect_enabled" boolean DEFAULT true,"collect_token" text DEFAULT (gen_random_uuid())::text,"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.budget_settings TO anon,authenticated;
CREATE TABLE public.self_tape_submissions("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"applicant_id" uuid NOT NULL,"video_url" text NOT NULL,"platform" text,"label" text DEFAULT 'Self Tape'::text,"submitted_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"scope" text DEFAULT 'general_audition'::text NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.self_tape_submissions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.self_tape_submissions TO anon,authenticated;
CREATE TABLE public.sponsor_files("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"business_id" uuid NOT NULL,"file_url" text NOT NULL,"file_name" text NOT NULL,"file_type" text DEFAULT 'asset'::text,"file_size" integer,"linked_ad_id" uuid,"linked_package_id" uuid,"uploaded_by" text,"notes" text,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.sponsor_files ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sponsor_files TO anon,authenticated;
CREATE TABLE public.production_props("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"category" text DEFAULT 'Props'::text,"description" text,"script_page_refs" text[] DEFAULT '{}'::text[],"department_name" text DEFAULT 'Props'::text,"status" text DEFAULT 'Needed'::text,"source_type" text,"quantity" integer DEFAULT 1,"notes" text,"assigned_to" text,"created_at" timestamp with time zone DEFAULT now(),"characters" text[] DEFAULT '{}'::text[],"quantity_unit" text DEFAULT 'total'::text,"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.production_props ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_props TO anon,authenticated;
CREATE TABLE public.daily_checkins("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"check_in_date" date NOT NULL,"person_type" text NOT NULL,"ref_id" text NOT NULL,"person_name" text NOT NULL,"role_name" text,"checked_in" boolean DEFAULT false,"checked_in_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"signed_out_at" timestamp with time zone,"away_today" boolean DEFAULT false,"attendance_note" text,PRIMARY KEY(id));
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.daily_checkins TO anon,authenticated;
CREATE TABLE public.portal_permissions("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"person_id" text NOT NULL,"person_type" text NOT NULL,"module_key" text NOT NULL,"access_level" text DEFAULT 'view'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.portal_permissions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.portal_permissions TO anon,authenticated;
CREATE TABLE public.production_proposals("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid NOT NULL,"status" text DEFAULT 'draft'::text NOT NULL,"proposed_show_title" text NOT NULL,"show_version" text,"licensing_company" text,"estimated_licensing_fee" numeric(12,2),"pitch_submitted_by" text,"pitch_submitted_by_user_id" uuid,"submitted_at" timestamp with time zone,"runtime_minutes" integer,"number_of_songs" integer,"named_roles" integer,"has_intermission" boolean DEFAULT false,"genre_type" text,"short_synopsis" text,"organization_fit" text,"character_list" text,"ensemble_opportunities" text,"gender_flexibility" text,"sets_level" text,"costumes_level" text,"choreography_level" text,"music_level" text,"technical_requirements_level" text,"content_warnings" text,"special_requirements" text,"biggest_challenge" text,"additional_notes" text,"internal_notes" text,"selected_production_id" uuid,"selected_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"submitter_email" text,"submitter_phone" text,"submission_origin" text DEFAULT 'internal'::text NOT NULL,"intake_id" uuid,"form_answers" jsonb DEFAULT '{}'::jsonb,"production_type" text,"scoring" jsonb DEFAULT '{}'::jsonb,PRIMARY KEY(id));
ALTER TABLE public.production_proposals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_proposals TO anon,authenticated;
CREATE TABLE public.costume_groups("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"name" text NOT NULL,"notes" text,"sort_order" integer DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.costume_groups ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.costume_groups TO anon,authenticated;
CREATE TABLE public.applications("id" uuid DEFAULT gen_random_uuid() NOT NULL,"profile_id" uuid,"audition_id" uuid,"status" text DEFAULT 'Applied'::text,"created_at" timestamp with time zone DEFAULT now(),"notes" text,"character_id" uuid,PRIMARY KEY(id));
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.applications TO anon,authenticated;
CREATE TABLE public.audition_custom_questions("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"question_text" text NOT NULL,"question_type" text DEFAULT 'text'::text NOT NULL,"options" jsonb DEFAULT '[]'::jsonb,"required" boolean DEFAULT false,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.audition_custom_questions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audition_custom_questions TO anon,authenticated;
CREATE TABLE public.checklist_items("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"title" text NOT NULL,"category" text,"status" text DEFAULT 'not_started'::text,"description" text,"due_date" date,"notes" text,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.checklist_items TO anon,authenticated;
CREATE TABLE public.casting_assignments("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"character_id" uuid,"applicant_id" uuid,"state" text DEFAULT 'applied'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now(),"reg_payment_notes" text,"volunteer_discount_approved" boolean DEFAULT false,"scholarship_status" text DEFAULT 'none'::text,"volunteer_signup_ids" text[] DEFAULT '{}'::text[],"volunteer_signup_name" text,"volunteer_hours_completed" numeric,"volunteer_role_notes" text,"scholarship_amount" numeric DEFAULT 0,"volunteer_discount_per_child" boolean DEFAULT false,"dropped_out" boolean DEFAULT false NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.casting_assignments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.casting_assignments TO anon,authenticated;
CREATE TABLE public.costume_assignments("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"application_id" uuid NOT NULL,"group_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.costume_assignments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.costume_assignments TO anon,authenticated;
CREATE TABLE public.auditions("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"type" text,"instructions" text,"dates" text,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.auditions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.auditions TO anon,authenticated;
CREATE TABLE public.callback_groups("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"colour" text DEFAULT '#efab45'::text,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.callback_groups ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.callback_groups TO anon,authenticated;
CREATE TABLE public.castings("id" uuid DEFAULT gen_random_uuid() NOT NULL,"role_id" uuid,"application_id" uuid,"type" text,PRIMARY KEY(id));
ALTER TABLE public.castings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.castings TO anon,authenticated;
CREATE TABLE public.email_templates("id" uuid DEFAULT gen_random_uuid() NOT NULL,"org_id" uuid,"trigger" text DEFAULT 'manual'::text NOT NULL,"enabled" boolean DEFAULT true,"subject" text DEFAULT ''::text NOT NULL,"body" text DEFAULT ''::text NOT NULL,"updated_at" timestamp with time zone DEFAULT now(),"production_id" uuid,"created_at" timestamp with time zone DEFAULT now(),"category" text DEFAULT 'general'::text NOT NULL,"name" text DEFAULT ''::text NOT NULL,"reviewed_at" timestamp with time zone,PRIMARY KEY(id));
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.email_templates TO anon,authenticated;
CREATE TABLE public.org_folders("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"name" text NOT NULL,"color" text DEFAULT '#572e88'::text,"is_default" boolean DEFAULT false,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.org_folders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.org_folders TO anon,authenticated;
CREATE TABLE public.opportunities("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"production_id" uuid,"opportunity_type" text NOT NULL,"production_title" text NOT NULL,"organization_name" text NOT NULL,"summary" text,"description" text,"location_text" text,"mode_tag" text,"open_date" date,"close_date" date,"primary_image_url" text,"public_slug" text,"status" text DEFAULT 'draft'::text,"age_range" text,"audition_dates" text,"callback_dates" text,"what_to_prepare" text,"volunteer_role" text,"time_commitment" text,"age_requirements" text,"created_at" timestamp with time zone DEFAULT now(),"volunteers_needed" integer,"event_id" uuid,"event_date" date,PRIMARY KEY(id));
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.opportunities TO anon,authenticated;
CREATE TABLE public.org_files("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"folder_id" uuid,"name" text NOT NULL,"file_url" text NOT NULL,"file_path" text,"file_type" text,"file_size" bigint,"tags" text[] DEFAULT '{}'::text[],"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.org_files ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.org_files TO anon,authenticated;
CREATE TABLE public.past_shows("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"title" text NOT NULL,"year" integer NOT NULL,"director" text,"musical_director" text,"poster_url" text,"created_at" timestamp with time zone DEFAULT now(),"choreographer" text,PRIMARY KEY(id));
ALTER TABLE public.past_shows ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.past_shows TO anon,authenticated;
CREATE TABLE public.producer_tasks("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"checklist_item_id" uuid,"title" text NOT NULL,"status" text DEFAULT 'not_started'::text,"priority" text DEFAULT 'normal'::text,"due_date" date,"assigned_to" text,"notes" text,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"completed_at" timestamp with time zone,"completed_by" text,PRIMARY KEY(id));
ALTER TABLE public.producer_tasks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.producer_tasks TO anon,authenticated;
CREATE TABLE public.cast_members("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"applicant_id" uuid,"character_id" uuid,"character_name" text,"state" text DEFAULT 'chosen'::text NOT NULL,"name" text,"preferred_name" text,"pronouns" text,"date_of_birth" date,"email" text,"phone" text,"guardian_name" text,"guardian_email" text,"guardian_phone" text,"headshot_url" text,"registration_answers" jsonb DEFAULT '{}'::jsonb,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"role_key" text NOT NULL,"role_type" text,"source_table" text,"casting_assignment_id" uuid,"accepted_at" timestamp with time zone,"internal_notes" text,PRIMARY KEY(id));
ALTER TABLE public.cast_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.cast_members TO anon,authenticated;
CREATE TABLE public.org_team_templates("id" uuid DEFAULT gen_random_uuid() NOT NULL,"org_id" uuid,"name" text NOT NULL,"departments" jsonb DEFAULT '[]'::jsonb NOT NULL,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.org_team_templates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.org_team_templates TO anon,authenticated;
CREATE TABLE public.production_folders("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"color" text DEFAULT '#572e88'::text,"is_default" boolean DEFAULT false,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.production_folders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_folders TO anon,authenticated;
CREATE TABLE public.production_events("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"title" text NOT NULL,"event_type" text NOT NULL,"start_time" timestamp with time zone NOT NULL,"end_time" timestamp with time zone,"all_day" boolean DEFAULT false,"notes" text,"ai_generated" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"venue" text,"is_public" boolean DEFAULT false,"is_deadline" boolean DEFAULT false,"show_in_cast_schedule" boolean DEFAULT false,"arrive_note" text,"bring_note" text,"know_note" text,"called_character_ids" jsonb DEFAULT '[]'::jsonb,"event_checkins" jsonb DEFAULT '[]'::jsonb,"is_locked" boolean DEFAULT false,"locked_at" timestamp with time zone,"called_cast" jsonb,"time_tbd" boolean DEFAULT false NOT NULL,"mandatory" boolean DEFAULT false NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_events TO anon,authenticated;
CREATE TABLE public.production_files("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"folder_id" uuid,"name" text NOT NULL,"file_url" text NOT NULL,"file_path" text,"file_type" text,"file_size" bigint,"tags" text[] DEFAULT '{}'::text[],"created_at" timestamp with time zone DEFAULT now(),"document_type" text,PRIMARY KEY(id));
ALTER TABLE public.production_files ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_files TO anon,authenticated;
CREATE TABLE public.production_crew("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"name" text NOT NULL,"role_title" text NOT NULL,"department" text,"notes" text,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.production_crew ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_crew TO anon,authenticated;
CREATE TABLE public.production_roles("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"type" text DEFAULT 'role'::text,"notes" text,"cast_member_id" uuid,"status" text DEFAULT 'open'::text,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.production_roles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_roles TO anon,authenticated;
CREATE TABLE public.roles("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.roles TO anon,authenticated;
CREATE TABLE public.venues("id" uuid DEFAULT gen_random_uuid() NOT NULL,"org_id" uuid,"name" text NOT NULL,"address" text,"map_url" text,"created_at" timestamp with time zone DEFAULT now(),"place_id" text,"lat" numeric,"lng" numeric,"nickname" text,"capacity" integer,"type" text,"tags" text[] DEFAULT '{}'::text[],"notes" text,"photo_url" text,"uses" text[],"details" jsonb,"website" text,"contact_name" text,"contact_phone" text,"contact_email" text,"photo_path" text,"is_favourite" boolean DEFAULT false,"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.venues TO anon,authenticated;
CREATE TABLE public.venue_layouts("id" uuid DEFAULT gen_random_uuid() NOT NULL,"venue_id" uuid,"version" integer DEFAULT 1,"name" text,"stage_position" text DEFAULT 'top'::text,"is_active" boolean DEFAULT true,"layout_data" jsonb DEFAULT '{}'::jsonb,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.venue_layouts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.venue_layouts TO anon,authenticated;
CREATE TABLE public.venue_sections("id" uuid DEFAULT gen_random_uuid() NOT NULL,"layout_id" uuid,"name" text NOT NULL,"color" text,"display_order" integer DEFAULT 0,PRIMARY KEY(id));
ALTER TABLE public.venue_sections ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.venue_sections TO anon,authenticated;
CREATE TABLE public.production_proposal_intakes("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid NOT NULL,"title" text NOT NULL,"season_label" text,"description" text,"access_token" text DEFAULT encode(gen_random_bytes(12), 'hex'::text) NOT NULL,"access_code" text NOT NULL,"is_open" boolean DEFAULT true NOT NULL,"closes_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"production_type" text,"performer_age" text,"cast_size" text,"min_performer_age" integer,"max_performer_age" integer,"parent_id" uuid,"projects" jsonb DEFAULT '[]'::jsonb,"form_config" jsonb,PRIMARY KEY(id));
ALTER TABLE public.production_proposal_intakes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_proposal_intakes TO anon,authenticated;
CREATE TABLE public.venue_rows("id" uuid DEFAULT gen_random_uuid() NOT NULL,"section_id" uuid,"label" text NOT NULL,"display_order" integer DEFAULT 0,PRIMARY KEY(id));
ALTER TABLE public.venue_rows ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.venue_rows TO anon,authenticated;
CREATE TABLE public.scene_notes("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"scene_id" uuid NOT NULL,"body" text NOT NULL,"note_type" text DEFAULT 'general'::text NOT NULL,"department_tags" text[] DEFAULT '{}'::text[] NOT NULL,"author_name" text,"author_role" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.scene_notes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.scene_notes TO anon,authenticated;
CREATE TABLE public.production_acts("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"number" integer DEFAULT 1 NOT NULL,"title" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.production_acts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_acts TO anon,authenticated;
CREATE TABLE public.production_scenes("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"act_id" uuid,"number" integer DEFAULT 1 NOT NULL,"title" text NOT NULL,"location" text,"description" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.production_scenes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_scenes TO anon,authenticated;
CREATE TABLE public.scene_characters("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"scene_id" uuid NOT NULL,"character_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.scene_characters ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.scene_characters TO anon,authenticated;
CREATE TABLE public.scene_groups("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"scene_id" uuid NOT NULL,"group_name" text NOT NULL,"member_count" integer,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.scene_groups ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.scene_groups TO anon,authenticated;
CREATE TABLE public.venue_seats("id" uuid DEFAULT gen_random_uuid() NOT NULL,"layout_id" uuid,"section_id" uuid,"row_id" uuid,"label" text,"seat_number" integer,"seat_type" text DEFAULT 'standard'::text,"accessible" boolean DEFAULT false,"companion" boolean DEFAULT false,"visible" boolean DEFAULT true,"default_price_tier" text,"x_position" double precision,"y_position" double precision,"rotation" double precision DEFAULT 0,"notes" text,PRIMARY KEY(id));
ALTER TABLE public.venue_seats ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.venue_seats TO anon,authenticated;
CREATE TABLE public.performance_seat_inventory("id" uuid DEFAULT gen_random_uuid() NOT NULL,"performance_id" uuid NOT NULL,"seat_id" uuid,"status" text DEFAULT 'available'::text,"price_tier" text,"hold_id" uuid,"order_id" uuid,"ticket_id" uuid,"blocked_reason" text,"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.performance_seat_inventory ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.performance_seat_inventory TO anon,authenticated;
CREATE TABLE public.seat_holds("id" uuid DEFAULT gen_random_uuid() NOT NULL,"performance_id" uuid NOT NULL,"seat_id" uuid,"session_id" text,"customer_email" text,"expires_at" timestamp with time zone NOT NULL,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.seat_holds ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.seat_holds TO anon,authenticated;
CREATE TABLE public.tickets("id" uuid DEFAULT gen_random_uuid() NOT NULL,"order_id" uuid,"production_id" uuid NOT NULL,"performance_id" uuid NOT NULL,"seat_id" uuid,"ticket_type_id" uuid,"owner_name" text,"owner_email" text,"qr_code" text,"status" text DEFAULT 'active'::text,"price_cents" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tickets TO anon,authenticated;
CREATE TABLE public.scan_events("id" uuid DEFAULT gen_random_uuid() NOT NULL,"ticket_id" uuid,"performance_id" uuid NOT NULL,"device" text,"result" text DEFAULT 'admitted'::text,"scanned_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.scan_events TO anon,authenticated;
CREATE TABLE public.production_script_import_items("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"item_kind" text NOT NULL,"item_key" text NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL,"item_data" jsonb DEFAULT '{}'::jsonb NOT NULL,"source_filename" text,"source_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.production_script_import_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_script_import_items TO anon,authenticated;
CREATE TABLE public.sponsor_businesses("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"contact_name" text,"contact_email" text,"contact_phone" text,"website" text,"social_links" jsonb DEFAULT '{}'::jsonb,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"contact_website" text,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,PRIMARY KEY(id));
ALTER TABLE public.sponsor_businesses ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sponsor_businesses TO anon,authenticated;
CREATE TABLE public.registration_payment_records("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"casting_assignment_id" uuid NOT NULL,"installment_index" integer DEFAULT 0 NOT NULL,"paid" boolean DEFAULT false NOT NULL,"paid_at" timestamp with time zone,"updated_at" timestamp with time zone DEFAULT now(),"amount_cents" integer,"paid_by" text,"payment_notes" text,"transaction_ref" text,"payment_method" text,PRIMARY KEY(id));
ALTER TABLE public.registration_payment_records ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.registration_payment_records TO anon,authenticated;
CREATE TABLE public.programme_ads("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"business_id" uuid,"ad_size" text,"ad_type" text DEFAULT 'colour'::text,"price_cents" integer DEFAULT 0,"payment_status" text DEFAULT 'unpaid'::text,"artwork_status" text DEFAULT 'missing'::text,"approval_status" text DEFAULT 'pending'::text,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"artwork_url" text,"format" text DEFAULT 'colour'::text,"size_id" text,"artwork_data" jsonb,"invoice_number" text,"invoice_sent_date" date,"payment_received_date" date,"payment_amount_cents" integer DEFAULT 0,"booking_status" text DEFAULT 'submitted'::text,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"payment_method" text,PRIMARY KEY(id));
ALTER TABLE public.programme_ads ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.programme_ads TO anon,authenticated;
CREATE TABLE public.sponsor_packages("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"business_id" uuid,"tier_name" text,"amount_cents" integer DEFAULT 0,"payment_status" text DEFAULT 'unpaid'::text,"benefits" text,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"tier_id" text,"artwork_data" jsonb,"invoice_number" text,"invoice_sent_date" date,"payment_received_date" date,"payment_amount_cents" integer DEFAULT 0,"artwork_status" text DEFAULT 'missing'::text,"artwork_url" text,"booking_status" text DEFAULT 'submitted'::text,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"payment_method" text,PRIMARY KEY(id));
ALTER TABLE public.sponsor_packages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sponsor_packages TO anon,authenticated;
CREATE TABLE public.budget_items("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"category_id" uuid,"name" text NOT NULL,"vendor" text,"budgeted_cents" integer DEFAULT 0 NOT NULL,"committed_cents" integer DEFAULT 0 NOT NULL,"paid_cents" integer DEFAULT 0 NOT NULL,"status" text DEFAULT 'planned'::text NOT NULL,"notes" text,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),"qty" numeric DEFAULT 1,"unit_cost_cents" integer DEFAULT 0,"tax_cents" integer DEFAULT 0,PRIMARY KEY(id));
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.budget_items TO anon,authenticated;
CREATE TABLE public.sponsor_deliverables("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"business_id" uuid,"ad_id" uuid,"sponsor_id" uuid,"title" text NOT NULL,"due_date" date,"assigned_to" text,"status" text DEFAULT 'open'::text,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"linked_package_id" uuid,"auto_generated" boolean DEFAULT false,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"linked_ad_id" uuid,PRIMARY KEY(id));
ALTER TABLE public.sponsor_deliverables ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sponsor_deliverables TO anon,authenticated;
CREATE TABLE public.sponsor_settings("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"settings" jsonb DEFAULT '{}'::jsonb,"updated_at" timestamp with time zone DEFAULT now(),PRIMARY KEY(id));
ALTER TABLE public.sponsor_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sponsor_settings TO anon,authenticated;
CREATE POLICY legacy_permissive ON public.budget_categories FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.household_payment_logs FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.budget_receipts FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.ticket_types FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.organization_planning_events FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.ticket_orders FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.budget_settings FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.self_tape_submissions FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.sponsor_files FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_props FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.daily_checkins FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.portal_permissions FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_proposals FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.costume_groups FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.applications FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.audition_custom_questions FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.checklist_items FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.casting_assignments FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.costume_assignments FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.auditions FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.callback_groups FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.castings FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.email_templates FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.org_folders FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.opportunities FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.org_files FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.past_shows FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.producer_tasks FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.cast_members FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.org_team_templates FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_folders FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_events FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_files FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_crew FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_roles FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.roles FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.venues FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.venue_layouts FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.venue_sections FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_proposal_intakes FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.venue_rows FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.scene_notes FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_acts FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_scenes FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.scene_characters FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.scene_groups FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.venue_seats FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.performance_seat_inventory FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.seat_holds FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.tickets FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.scan_events FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.production_script_import_items FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.sponsor_businesses FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.registration_payment_records FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.programme_ads FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.sponsor_packages FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.budget_items FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.sponsor_deliverables FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY legacy_permissive ON public.sponsor_settings FOR ALL USING(true) WITH CHECK(true);
CREATE OR REPLACE FUNCTION public.organisation_observation_delete(p_production_id uuid, p_observation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM production_audition_observations WHERE id = p_observation_id AND production_id = p_production_id AND source_type = 'organisation';
  RETURN FOUND;
END; $function$
;
CREATE OR REPLACE FUNCTION public.bts_can_access_production(target_production_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id = target_production_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from org_members om
          where om.org_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.lookup_email_by_bts_id(bts_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result_email text;
BEGIN
  SELECT u.email INTO result_email
  FROM member_ids m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.display_id = bts_id
  LIMIT 1;
  RETURN result_email;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_slot_booked_counts(p_production_id uuid)
 RETURNS TABLE(slot_id uuid, total_booked bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT slot_id, COUNT(*) AS total_booked
  FROM (
    SELECT slot_id
    FROM audition_applications
    WHERE production_id = p_production_id
      AND slot_id IS NOT NULL
      AND LOWER(COALESCE(status,'')) NOT IN ('canceled','cancelled')
    UNION ALL
    SELECT slot_id
    FROM audition_bookings
    WHERE production_id = p_production_id
      AND slot_id IS NOT NULL
      AND LOWER(COALESCE(status,'')) NOT IN ('canceled','cancelled')
  ) combined
  GROUP BY slot_id;
$function$
;
CREATE OR REPLACE FUNCTION public.lock_organization_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    RAISE EXCEPTION 'Organisation link cannot be changed after creation';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.organisation_observation_upsert(p_production_id uuid, p_applicant_id uuid, p_session_id uuid DEFAULT NULL::uuid, p_character_id uuid DEFAULT NULL::uuid, p_observation_area text DEFAULT 'in_room'::text, p_observation_type text DEFAULT 'general'::text, p_observation_key text DEFAULT 'general'::text, p_value text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_author_name text DEFAULT NULL::text, p_author_role text DEFAULT NULL::text, p_author_color text DEFAULT '#b8b4c0'::text)
 RETURNS SETOF production_audition_observations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_obs_id uuid;
BEGIN
  SELECT id INTO v_obs_id FROM production_audition_observations
    WHERE production_id = p_production_id AND applicant_id = p_applicant_id
      AND source_type = 'organisation' AND team_member_id IS NULL
      AND observation_area = p_observation_area AND observation_type = p_observation_type AND observation_key = p_observation_key
      AND (p_session_id IS NULL AND session_id IS NULL OR session_id = p_session_id)
      AND (p_character_id IS NULL AND character_id IS NULL OR character_id = p_character_id) LIMIT 1;
  IF v_obs_id IS NOT NULL THEN
    UPDATE production_audition_observations SET value = p_value, body = p_body, metadata = COALESCE(p_metadata,'{}'), updated_at = now() WHERE id = v_obs_id;
  ELSE
    INSERT INTO production_audition_observations (production_id,applicant_id,session_id,character_id,source_type,team_member_id,author_name,author_role,author_color,observation_area,observation_type,observation_key,value,body,metadata)
    VALUES (p_production_id,p_applicant_id,p_session_id,p_character_id,'organisation',NULL,p_author_name,p_author_role,p_author_color,p_observation_area,p_observation_type,p_observation_key,p_value,p_body,COALESCE(p_metadata,'{}'))
    RETURNING id INTO v_obs_id;
  END IF;
  RETURN QUERY SELECT * FROM production_audition_observations WHERE id = v_obs_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.remove_production_team_member(p_production_id uuid, p_team_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_observations_deleted integer := 0;
  v_notes_deleted integer := 0;
  v_sessions_deleted integer := 0;
  v_members_deleted integer := 0;
BEGIN
  IF to_regclass('public.production_audition_observations') IS NOT NULL THEN
    EXECUTE
      'DELETE FROM production_audition_observations
       WHERE production_id = $1
         AND team_member_id = $2'
    USING p_production_id, p_team_member_id;
    GET DIAGNOSTICS v_observations_deleted = ROW_COUNT;
  END IF;

  DELETE FROM production_audition_notes
  WHERE production_id = p_production_id
    AND team_member_id = p_team_member_id;
  GET DIAGNOSTICS v_notes_deleted = ROW_COUNT;

  DELETE FROM production_team_member_sessions
  WHERE production_id = p_production_id
    AND team_member_id = p_team_member_id;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  DELETE FROM production_team_members
  WHERE production_id = p_production_id
    AND id = p_team_member_id;
  GET DIAGNOSTICS v_members_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'team_members_deleted', v_members_deleted,
    'sessions_deleted', v_sessions_deleted,
    'notes_deleted', v_notes_deleted,
    'observations_deleted', v_observations_deleted
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_production_audition_observations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.try_uuid(p_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception
  when others then
    return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.public_production_contact(p_production_id uuid)
 RETURNS TABLE(name text, role text, email text, phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    tm.name,
    tm.role,
    tm.email,
    tm.phone
  FROM production_team_members tm
  WHERE tm.production_id = p_production_id
    AND coalesce(tm.is_active, true) = true
    AND (
      lower(coalesce(tm.access_level, '')) IN ('producer', 'owner', 'admin', 'administrator')
      OR lower(coalesce(tm.role, '')) LIKE '%producer%'
      OR lower(coalesce(tm.role, '')) LIKE '%admin%'
      OR lower(coalesce(tm.role, '')) LIKE '%owner%'
    )
  ORDER BY
    CASE
      WHEN lower(coalesce(tm.access_level, '')) = 'producer' OR lower(coalesce(tm.role, '')) LIKE '%producer%' THEN 0
      WHEN lower(coalesce(tm.access_level, '')) = 'owner' OR lower(coalesce(tm.role, '')) LIKE '%owner%' THEN 1
      ELSE 2
    END,
    tm.created_at ASC
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_sponsor_production(p_production_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.productions p
    join public.organizations o on o.id = p.organization_id
    where p.id = p_production_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1 from public.org_members om
          where om.org_id = p.organization_id and om.user_id = auth.uid()
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.production_proposals_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.submit_public_production_proposal(p_org_key text, p_token text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org public.organizations%rowtype;
  v_inserted public.production_proposals%rowtype;
begin
  select *
  into v_org
  from public.organizations
  where proposal_submission_token = p_token
    and (
      id::text = p_org_key
      or lower(coalesce(slug, '')) = lower(coalesce(p_org_key, ''))
      or lower(coalesce(abbreviation, '')) = lower(coalesce(p_org_key, ''))
    )
  limit 1;

  if v_org.id is null then
    raise exception 'Proposal page not found'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_payload->>'proposed_show_title', '')), '') is null then
    raise exception 'Proposed show title is required'
      using errcode = 'P0001';
  end if;

  insert into public.production_proposals (
    organization_id,
    status,
    proposed_show_title,
    show_version,
    licensing_company,
    estimated_licensing_fee,
    pitch_submitted_by,
    submitter_email,
    submitter_phone,
    submitted_at,
    runtime_minutes,
    number_of_songs,
    named_roles,
    has_intermission,
    genre_type,
    short_synopsis,
    organization_fit,
    character_list,
    ensemble_opportunities,
    gender_flexibility,
    sets_level,
    costumes_level,
    choreography_level,
    music_level,
    technical_requirements_level,
    content_warnings,
    special_requirements,
    biggest_challenge,
    additional_notes,
    submission_origin
  )
  values (
    v_org.id,
    'submitted',
    btrim(p_payload->>'proposed_show_title'),
    nullif(btrim(coalesce(p_payload->>'show_version', '')), ''),
    nullif(btrim(coalesce(p_payload->>'licensing_company', '')), ''),
    nullif(btrim(coalesce(p_payload->>'estimated_licensing_fee', '')), '')::numeric(12,2),
    nullif(btrim(coalesce(p_payload->>'pitch_submitted_by', '')), ''),
    nullif(btrim(coalesce(p_payload->>'submitter_email', '')), ''),
    nullif(btrim(coalesce(p_payload->>'submitter_phone', '')), ''),
    now(),
    nullif(btrim(coalesce(p_payload->>'runtime_minutes', '')), '')::integer,
    nullif(btrim(coalesce(p_payload->>'number_of_songs', '')), '')::integer,
    nullif(btrim(coalesce(p_payload->>'named_roles', '')), '')::integer,
    coalesce((p_payload->>'has_intermission')::boolean, false),
    nullif(btrim(coalesce(p_payload->>'genre_type', '')), ''),
    nullif(btrim(coalesce(p_payload->>'short_synopsis', '')), ''),
    nullif(btrim(coalesce(p_payload->>'organization_fit', '')), ''),
    nullif(btrim(coalesce(p_payload->>'character_list', '')), ''),
    nullif(btrim(coalesce(p_payload->>'ensemble_opportunities', '')), ''),
    nullif(btrim(coalesce(p_payload->>'gender_flexibility', '')), ''),
    case
      when lower(coalesce(p_payload->>'sets_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'sets_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'costumes_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'costumes_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'choreography_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'choreography_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'music_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'music_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'technical_requirements_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'technical_requirements_level')
      else 'medium'
    end,
    nullif(btrim(coalesce(p_payload->>'content_warnings', '')), ''),
    nullif(btrim(coalesce(p_payload->>'special_requirements', '')), ''),
    nullif(btrim(coalesce(p_payload->>'biggest_challenge', '')), ''),
    nullif(btrim(coalesce(p_payload->>'additional_notes', '')), ''),
    'public'
  )
  returning *
  into v_inserted;

  return jsonb_build_object(
    'proposal_id', v_inserted.id,
    'status', v_inserted.status,
    'submitted_at', v_inserted.submitted_at
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.production_proposal_intakes_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.submit_public_production_proposal(p_intake_key text, p_token text, p_access_code text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_intake public.production_proposal_intakes%rowtype;
  v_inserted public.production_proposals%rowtype;
BEGIN
  SELECT * INTO v_intake
  FROM public.production_proposal_intakes
  WHERE id::text = p_intake_key AND access_token = p_token LIMIT 1;
  IF v_intake.id IS NULL THEN RAISE EXCEPTION 'Proposal intake not found' USING errcode = 'P0001'; END IF;
  IF NOT v_intake.is_open THEN RAISE EXCEPTION 'This season pitch is closed' USING errcode = 'P0001'; END IF;
  IF v_intake.closes_at IS NOT NULL AND v_intake.closes_at < now() THEN RAISE EXCEPTION 'This season pitch has expired' USING errcode = 'P0001'; END IF;
  IF coalesce(v_intake.access_code, '') <> coalesce(p_access_code, '') THEN RAISE EXCEPTION 'Incorrect passcode' USING errcode = 'P0001'; END IF;
  IF nullif(btrim(coalesce(p_payload->>'proposed_show_title', '')), '') IS NULL THEN RAISE EXCEPTION 'Proposed show title is required' USING errcode = 'P0001'; END IF;

  INSERT INTO public.production_proposals (
    organization_id, intake_id, status,
    proposed_show_title, show_version, licensing_company, estimated_licensing_fee,
    pitch_submitted_by, submitter_email, submitter_phone, submitted_at,
    runtime_minutes, number_of_songs, named_roles, has_intermission,
    genre_type, short_synopsis, organization_fit, character_list,
    ensemble_opportunities, gender_flexibility,
    sets_level, costumes_level, choreography_level, music_level, technical_requirements_level,
    content_warnings, special_requirements, biggest_challenge, additional_notes,
    production_type, form_answers, submission_origin
  )
  VALUES (
    v_intake.organization_id, v_intake.id, 'submitted',
    btrim(p_payload->>'proposed_show_title'),
    nullif(btrim(coalesce(p_payload->>'show_version','')),  ''),
    nullif(btrim(coalesce(p_payload->>'licensing_company','')), ''),
    nullif(btrim(coalesce(p_payload->>'estimated_licensing_fee','')), '')::numeric(12,2),
    nullif(btrim(coalesce(p_payload->>'pitch_submitted_by','')), ''),
    nullif(btrim(coalesce(p_payload->>'submitter_email','')), ''),
    nullif(btrim(coalesce(p_payload->>'submitter_phone','')), ''),
    now(),
    nullif(btrim(coalesce(p_payload->>'runtime_minutes','')), '')::integer,
    nullif(btrim(coalesce(p_payload->>'number_of_songs','')), '')::integer,
    nullif(btrim(coalesce(p_payload->>'named_roles','')), '')::integer,
    coalesce((p_payload->>'has_intermission')::boolean, false),
    nullif(btrim(coalesce(p_payload->>'genre_type','')), ''),
    nullif(btrim(coalesce(p_payload->>'short_synopsis','')), ''),
    nullif(btrim(coalesce(p_payload->>'organization_fit','')), ''),
    nullif(btrim(coalesce(p_payload->>'character_list','')), ''),
    nullif(btrim(coalesce(p_payload->>'ensemble_opportunities','')), ''),
    nullif(btrim(coalesce(p_payload->>'gender_flexibility','')), ''),
    case when lower(coalesce(p_payload->>'sets_level','')) in ('low','medium','high') then lower(p_payload->>'sets_level') else 'medium' end,
    case when lower(coalesce(p_payload->>'costumes_level','')) in ('low','medium','high') then lower(p_payload->>'costumes_level') else 'medium' end,
    case when lower(coalesce(p_payload->>'choreography_level','')) in ('low','medium','high') then lower(p_payload->>'choreography_level') else 'medium' end,
    case when lower(coalesce(p_payload->>'music_level','')) in ('low','medium','high') then lower(p_payload->>'music_level') else 'medium' end,
    case when lower(coalesce(p_payload->>'technical_requirements_level','')) in ('low','medium','high') then lower(p_payload->>'technical_requirements_level') else 'medium' end,
    nullif(btrim(coalesce(p_payload->>'content_warnings','')), ''),
    nullif(btrim(coalesce(p_payload->>'special_requirements','')), ''),
    nullif(btrim(coalesce(p_payload->>'biggest_challenge','')), ''),
    nullif(btrim(coalesce(p_payload->>'additional_notes','')), ''),
    nullif(btrim(coalesce(p_payload->>'production_type','')), ''),
    coalesce(p_payload->'form_answers', '{}'::jsonb),
    'public'
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'proposal_id', v_inserted.id, 'status', v_inserted.status,
    'submitted_at', v_inserted.submitted_at, 'intake_id', v_inserted.intake_id
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_proposal_page(p_intake_key text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intake public.production_proposal_intakes%rowtype;
  v_org public.organizations%rowtype;
begin
  select *
  into v_intake
  from public.production_proposal_intakes
  where id::text = p_intake_key
    and access_token = p_token
  limit 1;

  if v_intake.id is null then
    raise exception 'Proposal intake not found'
      using errcode = 'P0001';
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_intake.organization_id
  limit 1;

  if v_org.id is null then
    raise exception 'Organization not found'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'abbreviation', v_org.abbreviation,
      'logo_url', v_org.logo_url,
      'logo_white_url', v_org.logo_white_url,
      'payment_settings', coalesce(v_org.payment_settings, '{}'::jsonb)
    ),
    'intake', jsonb_build_object(
      'id', v_intake.id,
      'title', v_intake.title,
      'season_label', v_intake.season_label,
      'description', v_intake.description,
      'is_open', v_intake.is_open,
      'closes_at', v_intake.closes_at,
      'projects', coalesce(v_intake.projects, '[]'::jsonb),
      'form_config', v_intake.form_config
    )
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.submit_sponsor_interest(p_production_id uuid, p_kind text, p_business_name text, p_contact_name text, p_contact_email text, p_contact_phone text DEFAULT NULL::text, p_option_id text DEFAULT NULL::text, p_option_label text DEFAULT NULL::text, p_format text DEFAULT NULL::text, p_amount_cents integer DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_settings jsonb; v_business_id uuid; v_option jsonb; v_expected_cents integer;
begin
  if p_kind not in ('sponsor','ad') then raise exception 'Unsupported sponsor request type'; end if;
  if nullif(trim(p_business_name),'') is null or nullif(trim(p_contact_name),'') is null or nullif(trim(p_contact_email),'') is null then raise exception 'Business, contact, and email are required'; end if;
  if length(p_business_name) > 180 or length(p_contact_name) > 180 or length(p_contact_email) > 320 then raise exception 'Submitted value is too long'; end if;

  select settings into v_settings from public.sponsor_settings where production_id = p_production_id;
  if v_settings is null or not coalesce((v_settings #>> '{publicPage,published}')::boolean, false) then raise exception 'Sponsor opportunities are not published'; end if;

  if p_kind = 'sponsor' then
    select item into v_option from jsonb_array_elements(coalesce(v_settings->'tiers','[]'::jsonb)) item where item->>'label' = p_option_label limit 1;
    if v_option is null then raise exception 'Sponsor tier is unavailable'; end if;
    v_expected_cents := round(coalesce((v_option->>'amount')::numeric,0) * 100);
  else
    select item into v_option from jsonb_array_elements(coalesce(v_settings->'adSizes','[]'::jsonb)) item where item->>'id' = p_option_id limit 1;
    if v_option is null or p_format not in ('colour','bw') then raise exception 'Programme ad option is unavailable'; end if;
    if p_format = 'colour' and coalesce((v_option->>'colour_enabled')::boolean,true) is false then raise exception 'Colour option is unavailable'; end if;
    if p_format = 'bw' and coalesce((v_option->>'bw_enabled')::boolean,true) is false then raise exception 'Black and white option is unavailable'; end if;
    v_expected_cents := round(coalesce((v_option->>case when p_format='colour' then 'colour' else 'bw' end)::numeric,0) * 100);
  end if;
  if v_expected_cents <> greatest(coalesce(p_amount_cents,0),0) then raise exception 'Option price changed; refresh and try again'; end if;

  insert into public.sponsor_businesses(production_id,name,contact_name,contact_email,contact_phone,notes)
  values(p_production_id,trim(p_business_name),trim(p_contact_name),lower(trim(p_contact_email)),nullif(trim(p_contact_phone),''),'Submitted from sponsor public page.')
  returning id into v_business_id;

  if p_kind = 'sponsor' then
    insert into public.sponsor_packages(production_id,business_id,tier_name,amount_cents,payment_status,notes)
    values(p_production_id,v_business_id,p_option_label,v_expected_cents,'unpaid',nullif(trim(p_notes),''));
  else
    insert into public.programme_ads(production_id,business_id,ad_size,ad_type,price_cents,payment_status,artwork_status,approval_status,notes)
    values(p_production_id,v_business_id,p_option_id,p_format,v_expected_cents,'unpaid','missing','pending',nullif(trim(p_notes),''));
  end if;
  return jsonb_build_object('ok',true,'business_id',v_business_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.finalize_sponsor_submission(p_production_id uuid, p_business_id uuid, p_kind text, p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_artwork_status text DEFAULT NULL::text, p_files jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ad_id uuid; v_submission_note text; v_file jsonb; v_file_name text; v_file_url text; v_file_path text;
begin
  if p_kind not in ('sponsor', 'ad') then raise exception 'Unsupported sponsor request type'; end if;
  if not exists (select 1 from public.sponsor_businesses b where b.id = p_business_id and b.production_id = p_production_id) then
    raise exception 'Sponsor submission not found';
  end if;
  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' then raise exception 'Uploaded files must be an array'; end if;

  v_submission_note := nullif(trim(p_notes), '');
  v_submission_note := coalesce(v_submission_note || E'\n\nSubmitted from sponsor public page.', 'Submitted from sponsor public page.');

  update public.sponsor_businesses set website = nullif(trim(p_website), ''), notes = v_submission_note, updated_at = now()
  where id = p_business_id and production_id = p_production_id;

  if p_kind = 'ad' then
    select a.id into v_ad_id from public.programme_ads a
    where a.production_id = p_production_id and a.business_id = p_business_id
    order by a.created_at desc, a.id desc limit 1;

    if v_ad_id is not null then
      update public.programme_ads set
        artwork_status = case when coalesce(jsonb_array_length(p_files), 0) > 0 and p_artwork_status = 'ready' then 'received' else artwork_status end,
        artwork_url = case when coalesce(jsonb_array_length(p_files), 0) > 0 then coalesce(nullif(trim((p_files->0->>'url')), ''), artwork_url) else artwork_url end,
        updated_at = now()
      where id = v_ad_id;
    end if;
  end if;

  for v_file in select value from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    v_file_name := nullif(trim(v_file->>'name'), '');
    v_file_url := nullif(trim(v_file->>'url'), '');
    v_file_path := nullif(trim(v_file->>'path'), '');
    if v_file_name is null or v_file_url is null or v_file_path is null then continue; end if;
    if position(p_production_id::text || '/' || p_business_id::text || '/' in v_file_path) <> 1 then raise exception 'Uploaded file path does not match this submission'; end if;
    if position('/storage/v1/object/public/programme-ads/' || v_file_path in v_file_url) = 0 then raise exception 'Uploaded file URL is invalid'; end if;

    insert into public.sponsor_files (business_id, file_url, file_name, file_type, linked_ad_id, uploaded_by)
    values (p_business_id, v_file_url, v_file_name, case when p_kind = 'ad' then 'artwork' else 'logo' end, v_ad_id, 'business');
  end loop;

  return jsonb_build_object('ok', true, 'business_id', p_business_id, 'ad_id', v_ad_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.finalize_sponsor_submission(p_production_id uuid, p_business_id uuid, p_kind text, p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_artwork_status text DEFAULT NULL::text, p_files jsonb DEFAULT '[]'::jsonb, p_artwork_data jsonb DEFAULT '{}'::jsonb, p_payment_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ad_id uuid;
  v_pkg_id uuid;
  v_submission_note text;
  v_file jsonb;
  v_file_name text;
  v_file_url text;
  v_file_path text;
  v_linked_id uuid;
begin
  if p_kind not in ('sponsor', 'ad') then
    raise exception 'Unsupported sponsor request type';
  end if;

  if p_payment_status is not null and p_payment_status not in ('unpaid', 'paid', 'invoice_sent', 'overdue', 'trade') then
    raise exception 'Unsupported payment status';
  end if;

  if not exists (
    select 1
    from public.sponsor_businesses b
    where b.id = p_business_id
      and b.production_id = p_production_id
  ) then
    raise exception 'Sponsor submission not found';
  end if;

  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' then
    raise exception 'Uploaded files must be an array';
  end if;

  if jsonb_typeof(coalesce(p_artwork_data, '{}'::jsonb)) <> 'object' then
    raise exception 'Artwork data must be an object';
  end if;

  v_submission_note := nullif(trim(p_notes), '');
  if v_submission_note is not null then
    v_submission_note := v_submission_note || E'\n\nSubmitted from sponsor public page.';
  else
    v_submission_note := 'Submitted from sponsor public page.';
  end if;

  update public.sponsor_businesses
  set website = nullif(trim(p_website), ''),
      notes = v_submission_note,
      updated_at = now()
  where id = p_business_id
    and production_id = p_production_id;

  if p_kind = 'ad' then
    select a.id
    into v_ad_id
    from public.programme_ads a
    where a.production_id = p_production_id
      and a.business_id = p_business_id
    order by a.created_at desc, a.id desc
    limit 1;

    if v_ad_id is not null then
      update public.programme_ads
      set artwork_status = case
            when coalesce(jsonb_array_length(p_files), 0) > 0 and p_artwork_status = 'ready' then 'received'
            else artwork_status
          end,
          artwork_url = case
            when coalesce(jsonb_array_length(p_files), 0) > 0 then coalesce(nullif(trim((p_files->0->>'url')), ''), artwork_url)
            else artwork_url
          end,
          artwork_data = coalesce(p_artwork_data, '{}'::jsonb),
          payment_status = coalesce(p_payment_status, payment_status),
          updated_at = now()
      where id = v_ad_id;
    end if;
    v_linked_id := v_ad_id;
  else
    select p.id
    into v_pkg_id
    from public.sponsor_packages p
    where p.production_id = p_production_id
      and p.business_id = p_business_id
    order by p.created_at desc, p.id desc
    limit 1;

    if v_pkg_id is not null then
      update public.sponsor_packages
      set artwork_data = coalesce(p_artwork_data, '{}'::jsonb),
          payment_status = coalesce(p_payment_status, payment_status),
          updated_at = now()
      where id = v_pkg_id;
    end if;
    v_linked_id := v_pkg_id;
  end if;

  for v_file in
    select value
    from jsonb_array_elements(coalesce(p_files, '[]'::jsonb))
  loop
    v_file_name := nullif(trim(v_file->>'name'), '');
    v_file_url := nullif(trim(v_file->>'url'), '');
    v_file_path := nullif(trim(v_file->>'path'), '');

    if v_file_name is null or v_file_url is null or v_file_path is null then
      continue;
    end if;

    if position(p_production_id::text || '/' || p_business_id::text || '/' in v_file_path) <> 1 then
      raise exception 'Uploaded file path does not match this submission';
    end if;

    if position('/storage/v1/object/public/programme-ads/' || v_file_path in v_file_url) = 0 then
      raise exception 'Uploaded file URL is invalid';
    end if;

    insert into public.sponsor_files (
      business_id,
      file_url,
      file_name,
      file_type,
      linked_ad_id,
      uploaded_by
    )
    values (
      p_business_id,
      v_file_url,
      v_file_name,
      case when p_kind = 'ad' then 'artwork' else 'logo' end,
      v_ad_id,
      'business'
    );
  end loop;

  return jsonb_build_object('ok', true, 'business_id', p_business_id, 'ad_id', v_ad_id, 'package_id', v_pkg_id);
end;
$function$
;
INSERT INTO storage.buckets SELECT unnest(ARRAY['org-files','production-files','audition-headshots','receipts','proposal-attachments','programme-ads','org-logos','org-banners','production-posters','past-posters','venue-photos']),true ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.bts_refresh_cast_members_from_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.cast_members
  set
    name = to_jsonb(new) ->> 'name',
    preferred_name = to_jsonb(new) ->> 'preferred_name',
    email = to_jsonb(new) ->> 'email',
    phone = to_jsonb(new) ->> 'phone',
    headshot_url = to_jsonb(new) ->> 'headshot_url',
    pronouns = to_jsonb(new) ->> 'pronouns',
    registration_answers = coalesce(to_jsonb(new) -> 'custom_answers', '{}'::jsonb),
    source_table = 'audition_bookings'
  where applicant_id = new.id
    and production_id = new.production_id;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bts_refresh_cast_members_from_character()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.cast_members
  set
    character_name = new.name,
    role_type = new.role_type
  where character_id = new.id;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bts_script_breakdown_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bts_cast_member_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bts_upsert_cast_member_from_assignment(p_assignment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  assignment_row public.casting_assignments%rowtype;
  app_row public.audition_applications%rowtype;
  booking_row public.audition_bookings%rowtype;
  character_row public.production_characters%rowtype;
  app_json jsonb;
  booking_json jsonb;
  next_role_key text;
  next_name text;
  next_preferred_name text;
  next_email text;
  next_phone text;
  next_headshot_url text;
  next_pronouns text;
  next_answers jsonb;
  next_source text;
begin
  select * into assignment_row
  from public.casting_assignments
  where id = p_assignment_id;

  if not found then
    delete from public.cast_members where casting_assignment_id = p_assignment_id;
    return;
  end if;

  if assignment_row.state not in ('chosen', 'offer_accepted', 'ensemble_manual') then
    delete from public.cast_members where casting_assignment_id = assignment_row.id;
    return;
  end if;

  if assignment_row.character_id is not null then
    select * into character_row
    from public.production_characters
    where id = assignment_row.character_id;
  end if;

  select * into app_row
  from public.audition_applications
  where id = assignment_row.applicant_id;

  if found then
    app_json := to_jsonb(app_row);
    next_source := 'audition_applications';
    next_name := app_json ->> 'name';
    next_preferred_name := app_json ->> 'preferred_name';
    next_email := app_json ->> 'email';
    next_phone := app_json ->> 'phone';
    next_headshot_url := app_json ->> 'headshot_url';
    next_pronouns := app_json ->> 'pronouns';
    next_answers := coalesce(app_json -> 'custom_answers', '{}'::jsonb);
  else
    select * into booking_row
    from public.audition_bookings
    where id = assignment_row.applicant_id;

    if found then
      booking_json := to_jsonb(booking_row);
      next_source := 'audition_bookings';
      next_name := booking_json ->> 'name';
      next_preferred_name := booking_json ->> 'preferred_name';
      next_email := booking_json ->> 'email';
      next_phone := booking_json ->> 'phone';
      next_headshot_url := booking_json ->> 'headshot_url';
      next_pronouns := booking_json ->> 'pronouns';
      next_answers := coalesce(booking_json -> 'custom_answers', '{}'::jsonb);
    else
      next_source := 'casting_assignments';
      next_answers := '{}'::jsonb;
    end if;
  end if;

  next_role_key := coalesce(assignment_row.character_id::text, 'ensemble');

  insert into public.cast_members (
    production_id,
    applicant_id,
    character_id,
    role_key,
    character_name,
    role_type,
    state,
    name,
    preferred_name,
    email,
    phone,
    headshot_url,
    pronouns,
    source_table,
    registration_answers,
    casting_assignment_id,
    accepted_at
  )
  values (
    assignment_row.production_id,
    assignment_row.applicant_id,
    assignment_row.character_id,
    next_role_key,
    coalesce(character_row.name, case when assignment_row.character_id is null then 'Ensemble' else null end),
    character_row.role_type,
    assignment_row.state,
    next_name,
    next_preferred_name,
    next_email,
    next_phone,
    next_headshot_url,
    next_pronouns,
    next_source,
    next_answers,
    assignment_row.id,
    coalesce(
      nullif(to_jsonb(assignment_row) ->> 'updated_at', '')::timestamptz,
      nullif(to_jsonb(assignment_row) ->> 'created_at', '')::timestamptz,
      now()
    )
  )
  on conflict (production_id, applicant_id, role_key)
  do update set
    character_id = excluded.character_id,
    character_name = excluded.character_name,
    role_type = excluded.role_type,
    state = excluded.state,
    name = excluded.name,
    preferred_name = excluded.preferred_name,
    email = excluded.email,
    phone = excluded.phone,
    headshot_url = excluded.headshot_url,
    pronouns = excluded.pronouns,
    source_table = excluded.source_table,
    registration_answers = excluded.registration_answers,
    casting_assignment_id = excluded.casting_assignment_id,
    accepted_at = excluded.accepted_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bts_sync_cast_member_assignment_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    delete from public.cast_members where casting_assignment_id = old.id;
    return old;
  end if;

  perform public.bts_upsert_cast_member_from_assignment(new.id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bts_refresh_cast_members_from_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.cast_members
  set
    name = to_jsonb(new) ->> 'name',
    preferred_name = to_jsonb(new) ->> 'preferred_name',
    email = to_jsonb(new) ->> 'email',
    phone = to_jsonb(new) ->> 'phone',
    headshot_url = to_jsonb(new) ->> 'headshot_url',
    pronouns = to_jsonb(new) ->> 'pronouns',
    registration_answers = coalesce(to_jsonb(new) -> 'custom_answers', '{}'::jsonb),
    source_table = 'audition_applications'
  where applicant_id = new.id
    and production_id = new.production_id;

  return new;
end;
$function$
;
