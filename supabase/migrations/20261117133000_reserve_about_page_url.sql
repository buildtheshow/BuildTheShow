-- Also reserve the existing About page address when allocating organisation web abbreviations.
-- Keep existing unique indexes and allocation rules; no organisation or profile records change.
CREATE OR REPLACE FUNCTION public.is_reserved_organization_slug(p_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(coalesce(p_slug,'')) = ANY(ARRAY['assets','backend','home','public','shared','system','functions','supabase','api','auth','login','logout','signup','member','members','org','admin','account','settings','pricing','find','privacy','terms','copyright','accessibility','volunteers','volunteer','volunteer-quiz','invite','opportunity','audition','audition-info','self-tape','callback-self-tape','callback-sides','callbacksides','forgot-password','reset-password','activities','manage','support','help','dashboard','billing','profile','users','organisations','organizations','productions','app','www','mail','registration','cast-offer','sponsors','tickets','callback-response','who-we-are']::text[]);
$$;
