#!/usr/bin/env python3
"""Prepare (or explicitly apply) an operator-reviewed household decision using the linked CLI."""
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
parser.add_argument('--verified-user', action='append', type=uuid.UUID, default=[])
parser.add_argument('--reason-file', type=Path, help='Local text recording checked authority and decision; avoid identity-document contents')
parser.add_argument('--apply', action='store_true', help='Execute against the linked project; otherwise print SQL for review')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
project_file = root / 'supabase/.temp/project-ref'
if not project_file.exists() or project_file.read_text().strip() != PROJECT:
    parser.error('Link the intended Build The Show project before using this tool.')
if args.list:
    sql = "SELECT id,kind,profile_id,requester_id,created_at FROM bts_private.family_reviews WHERE state='pending' ORDER BY created_at;"
else:
    if not args.request or not (args.approve or args.decline) or not args.reason_file:
        parser.error('Supply --request, --approve or --decline, and --reason-file.')
    reason = args.reason_file.read_text().strip()
    if len(reason) < 20:
        parser.error('Record the authority checked and decision in at least 20 characters.')
    if args.approve and not args.verified_user:
        parser.error('Approval requires the account IDs verified outside the application.')
    literal = "'" + reason.replace("'", "''") + "'"
    users = 'ARRAY[' + ','.join("'%s'::uuid" % user for user in args.verified_user) + ']::uuid[]'
    sql = "BEGIN;\nSET LOCAL lock_timeout='5s';\nSELECT public.bts_family_review_resolve('%s',%s,%s,%s);\nCOMMIT;" % (args.request, 'true' if args.approve else 'false', literal, users)
if not args.apply:
    print(sql)
else:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql') as temporary:
        temporary.write(sql)
        temporary.flush()
        subprocess.run(['supabase','db','query','--linked','--file',temporary.name], cwd=root, check=True)
