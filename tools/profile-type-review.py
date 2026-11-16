#!/usr/bin/env python3
"""Prepare (or explicitly apply) an operator-reviewed profile-type correction decision using the linked CLI."""
import argparse
from pathlib import Path
import subprocess
import tempfile
import uuid

PROJECT = 'tkmaiktxpwqfbgeojbnf'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--list', action='store_true', help='List pending review metadata')
parser.add_argument('--request', type=uuid.UUID)
choice = parser.add_mutually_exclusive_group()
choice.add_argument('--approve', action='store_true')
choice.add_argument('--decline', action='store_true')
parser.add_argument('--verified-user', type=uuid.UUID, help='Verified adult account requesting this correction')
parser.add_argument('--reason-file', type=Path, help='Local text recording checked authority and decision; avoid identity-document contents')
parser.add_argument('--apply', action='store_true', help='Execute against the linked project; otherwise print SQL for review')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
project_file = root / 'supabase/.temp/project-ref'
if not project_file.exists() or project_file.read_text().strip() != PROJECT:
    parser.error('Link the intended Build The Show project before using this tool.')
if args.list:
    sql = "SELECT id,actor_id,source_type,source_id,target_type,created_at FROM bts_private.profile_type_corrections WHERE state='needs_review' ORDER BY created_at;"
else:
    if not args.request or not (args.approve or args.decline) or not args.reason_file:
        parser.error('Supply --request, --approve or --decline, and --reason-file.')
    reason = args.reason_file.read_text().strip()
    if len(reason) < 20:
        parser.error('Record the authority checked and decision in at least 20 characters.')
    if args.approve and not args.verified_user:
        parser.error('Approval requires the account IDs verified outside the application.')
    literal = "'" + reason.replace("'", "''") + "'"
    verify = "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM bts_private.profile_type_corrections WHERE id='%s' AND actor_id='%s' AND state='needs_review') THEN RAISE EXCEPTION 'Verified account does not match the request';END IF;END $$;\n" % (args.request, args.verified_user) if args.approve else ''
    sql = "BEGIN;\nSET LOCAL lock_timeout='5s';\n" + verify + "SELECT public.bts_resolve_profile_type_correction('%s',%s,%s);\nCOMMIT;" % (args.request, 'true' if args.approve else 'false', literal)

if not args.apply:
    print(sql)
else:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql') as temporary:
        temporary.write(sql)
        temporary.flush()
        subprocess.run(['supabase','db','query','--linked','--file',temporary.name], cwd=root, check=True)
