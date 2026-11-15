# Supabase Auth email templates

These templates are for Supabase Authentication, separate from production email templates stored in the database. Committing them does not update the hosted Auth configuration.

## Reset password

In Supabase, open Authentication → Emails → Templates → Reset password.

- Subject: `Reset your Build The Show password`
- Body: the complete contents of `reset-password.html` in this directory.
- Save, then request a fresh password-reset email from the website.

Keep `{{ .ConfirmationURL }}` exactly as written. Supabase substitutes a private, single-use recovery URL for each message. A fixed website URL, `{{ .SiteURL }}` or `{{ .RedirectTo }}` alone does not verify a recovery request.

Under Authentication → URL Configuration, allow `https://buildtheshow.com/reset-password` and use the production website as the Site URL. Do not add a wildcard for arbitrary domains. Review any legitimate existing redirects before changing them.

Katie confirmed Custom SMTP is saved and a recovery email arrived on 2026-11-15. That message contained text without a reset link or code. Delivery is confirmed; successful recovery still needs the hosted template update and an end-to-end test. The agent has not sent test emails or changed anyone's password.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
