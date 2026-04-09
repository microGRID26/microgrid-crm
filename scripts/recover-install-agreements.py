#!/usr/bin/env python3
"""
Recover signed install agreement URLs from the NetSuite job JSON dump.

Each NetSuite job JSON contains a custentity_bb_enerflo_proj_images field with
an embedded HTML table mapping document labels to public Enerflo S3 URLs.
The "Agreement" row points at the executed (signed) install agreement PDF.

This script:
  1. Walks all ~28K JOB_*.json files
  2. Extracts PROJ-ID from cseg_bb_project.refName
  3. Parses the HTML table to find the Agreement URL
  4. Filters to only the project IDs in /tmp/problem_ids.txt
  5. Writes ~/Downloads/install_agreement_urls.csv

Usage:
  python3 scripts/recover-install-agreements.py
  python3 scripts/recover-install-agreements.py --all  # don't filter, dump everything

The output CSV is consumed by a follow-up step that either:
  - Inserts the URLs into project_documents (visible from CRM/app)
  - Downloads + uploads to Drive (proper fix, longer-running)
"""

import argparse
import csv
import json
import os
import re
import sys
from html import unescape

JSON_DIR = os.path.expanduser(
    '~/Desktop/EDGE/reference/ns_job_export_ALL_20260226_154512/json'
)
PROBLEM_IDS_FILE = '/tmp/problem_ids.txt'
OUT_CSV = os.path.expanduser('~/Downloads/install_agreement_urls.csv')
OUT_NOT_FOUND = os.path.expanduser('~/Downloads/install_agreement_not_found.txt')

PROJ_ID_RE = re.compile(r'(PROJ-\d+)')
AGREEMENT_ROW_RE = re.compile(
    r'<td[^>]*>\s*Agreement\s*</td>\s*<td[^>]*>\s*<a[^>]+href="([^"]+)"',
    re.IGNORECASE,
)


def load_problem_ids() -> set:
    if not os.path.exists(PROBLEM_IDS_FILE):
        print(f'WARNING: {PROBLEM_IDS_FILE} not found — falling back to --all behavior')
        return set()
    with open(PROBLEM_IDS_FILE) as f:
        return {line.strip() for line in f if line.strip().startswith('PROJ-')}


def extract_proj_id(data: dict) -> str:
    """Pull PROJ-NNNNN out of cseg_bb_project.refName like 'PROJ-15480 - Jimmy Villanueva'."""
    seg = data.get('cseg_bb_project') or {}
    ref = seg.get('refName', '') if isinstance(seg, dict) else ''
    m = PROJ_ID_RE.search(ref)
    return m.group(1) if m else ''


def extract_agreement_url(data: dict) -> str:
    """Parse the Enerflo HTML table for the Agreement row."""
    html_blob = data.get('custentity_bb_enerflo_proj_images', '') or ''
    if not html_blob:
        return ''
    m = AGREEMENT_ROW_RE.search(html_blob)
    if not m:
        return ''
    return unescape(m.group(1))


def extract_customer_name(data: dict) -> str:
    return data.get('companyName', '') or data.get('entityId', '') or ''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true',
                        help="Don't filter to problem IDs — dump every PROJ-ID we find")
    args = parser.parse_args()

    if not os.path.isdir(JSON_DIR):
        print(f'ERROR: {JSON_DIR} not found')
        sys.exit(1)

    problem_ids = set() if args.all else load_problem_ids()
    if problem_ids:
        print(f'Filtering to {len(problem_ids)} problem PROJ-IDs')
    else:
        print('No filter — dumping every PROJ-ID with an Agreement URL')

    files = sorted(f for f in os.listdir(JSON_DIR) if f.startswith('JOB_') and f.endswith('.json'))
    print(f'Walking {len(files)} JSON files in {JSON_DIR}\n')

    found = []  # (proj_id, customer, url, json_file)
    seen_proj_ids = set()
    no_proj_id = 0
    no_agreement = 0
    parse_errors = 0

    for i, fname in enumerate(files, 1):
        try:
            with open(os.path.join(JSON_DIR, fname)) as f:
                data = json.load(f)
        except Exception:
            parse_errors += 1
            continue

        proj_id = extract_proj_id(data)
        if not proj_id:
            no_proj_id += 1
            continue

        seen_proj_ids.add(proj_id)

        if problem_ids and proj_id not in problem_ids:
            continue

        url = extract_agreement_url(data)
        if not url:
            no_agreement += 1
            continue

        customer = extract_customer_name(data)
        found.append((proj_id, customer, url, fname))

        if i % 2000 == 0:
            print(f'  [{i:5}/{len(files)}] processed — {len(found)} agreement URLs found so far')

    # Dedupe by proj_id (keep first match)
    unique = {}
    for proj_id, customer, url, fname in found:
        if proj_id not in unique:
            unique[proj_id] = (customer, url, fname)

    # Write CSV
    with open(OUT_CSV, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['project_id', 'customer_name', 'agreement_url', 'source_json'])
        for proj_id, (customer, url, fname) in sorted(unique.items()):
            w.writerow([proj_id, customer, url, fname])

    # Write not-found list (problem IDs that didn't get an agreement URL)
    if problem_ids:
        not_found = sorted(problem_ids - set(unique.keys()))
        with open(OUT_NOT_FOUND, 'w') as f:
            f.write(f'# {len(not_found)} problem PROJ-IDs with no Agreement URL in NetSuite JSON dump\n\n')
            for proj_id in not_found:
                f.write(f'{proj_id}\n')

    # Summary
    print(f'\nSummary:')
    print(f'  Walked:               {len(files)} JSON files')
    print(f'  Parse errors:         {parse_errors}')
    print(f'  Missing PROJ-ID:      {no_proj_id}')
    print(f'  Missing Agreement:    {no_agreement}')
    print(f'  Unique PROJ-IDs seen: {len(seen_proj_ids)}')
    if problem_ids:
        print(f'  Problem IDs:          {len(problem_ids)}')
        print(f'  Recovered URLs:       {len(unique)}')
        print(f'  Still not found:     {len(problem_ids) - len(unique)}')
    else:
        print(f'  Total agreements found: {len(unique)}')
    print(f'\n  CSV: {OUT_CSV}')
    if problem_ids:
        print(f'  Not found: {OUT_NOT_FOUND}')


if __name__ == '__main__':
    main()
