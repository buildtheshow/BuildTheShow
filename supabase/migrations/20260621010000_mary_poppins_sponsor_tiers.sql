update public.sponsor_settings
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{tiers}',
  '[
    {
      "id": "cherry-tree-lane",
      "label": "Cherry Tree Lane Sponsor",
      "amount": 1000,
      "bullets": "Full-page colour programme advertisement\nSponsor recognition in the programme\nRecognized on Rainbow Youth Theatre social media throughout the Mary Poppins Jr. season\nLogo on the Rainbow Youth Theatre website for the duration of the production\nAcknowledgement during opening remarks before each performance"
    },
    {
      "id": "spoonful-of-sugar",
      "label": "A Spoonful of Sugar Sponsor",
      "amount": 2000,
      "slots": 1,
      "bullets": "Everything included in the Cherry Tree Lane Sponsor package, plus:\nLogo featured on the front cover of the official programme\nLogo on the Mary Poppins Jr. poster\nAcknowledgement on printed promotional materials\nTwo complimentary tickets to a performance"
    }
  ]'::jsonb,
  true
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(settings->'tiers', '[]'::jsonb)) tier
  where tier->>'label' = 'Presenting Sponsor'
)
and exists (
  select 1
  from jsonb_array_elements(coalesce(settings->'tiers', '[]'::jsonb)) tier
  where tier->>'label' = 'Friend'
);
