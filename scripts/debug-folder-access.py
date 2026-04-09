#!/usr/bin/env python3
"""Debug Drive API access to a specific folder. Tries multiple list strategies."""
import os, pickle, sys
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

TOKEN_FILE = os.path.expanduser('~/gdrive_token_readonly.pkl')

# PROJ-5012 — Greg confirmed in browser there's a PDF in 03 Installation Agreement
TEST_FOLDER_ID = '1Idc6akjLpiOSIScw06KTY5nnXi7bm9VG'

with open(TOKEN_FILE, 'rb') as f:
    creds = pickle.load(f)
if creds.expired and creds.refresh_token:
    creds.refresh(Request())

service = build('drive', 'v3', credentials=creds)

print('=' * 60)
print('0. about.get() — who is this token authenticated as?')
print('=' * 60)
try:
    about = service.about().get(fields='user').execute()
    print(f'  Email:        {about["user"].get("emailAddress")}')
    print(f'  Display name: {about["user"].get("displayName")}')
except Exception as e:
    print(f'  ERROR: {e}')
print()

print('=' * 60)
print('1. files.get() on PROJ-5012 folder — full metadata')
print('=' * 60)
try:
    meta = service.files().get(
        fileId=TEST_FOLDER_ID,
        fields='id, name, mimeType, parents, driveId, teamDriveId, capabilities, owners, shared',
        supportsAllDrives=True,
    ).execute()
    for k, v in meta.items():
        print(f'  {k}: {v}')
except Exception as e:
    print(f'  ERROR: {e}')

print()
print('=' * 60)
print('2. files.list() — basic, no corpora')
print('=' * 60)
try:
    r = service.files().list(
        q=f"'{TEST_FOLDER_ID}' in parents and trashed = false",
        fields='files(id, name, mimeType)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()
    print(f'  Returned {len(r.get("files", []))} children')
    for f in r.get('files', [])[:5]:
        print(f'    - {f["name"]}')
except Exception as e:
    print(f'  ERROR: {e}')

print()
print('=' * 60)
print("3. files.list() — corpora='allDrives'")
print('=' * 60)
try:
    r = service.files().list(
        q=f"'{TEST_FOLDER_ID}' in parents and trashed = false",
        fields='files(id, name, mimeType)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora='allDrives',
    ).execute()
    print(f'  Returned {len(r.get("files", []))} children')
    for f in r.get('files', [])[:5]:
        print(f'    - {f["name"]}')
except Exception as e:
    print(f'  ERROR: {e}')

print()
print('=' * 60)
print("4. files.list() — corpora='drive' with driveId from step 1")
print('=' * 60)
drive_id = meta.get('driveId') if 'meta' in dir() else None
if drive_id:
    try:
        r = service.files().list(
            q=f"'{TEST_FOLDER_ID}' in parents and trashed = false",
            fields='files(id, name, mimeType)',
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora='drive',
            driveId=drive_id,
        ).execute()
        print(f'  Returned {len(r.get("files", []))} children')
        for f in r.get('files', [])[:5]:
            print(f'    - {f["name"]}')
    except Exception as e:
        print(f'  ERROR: {e}')
else:
    print('  SKIPPED — no driveId from step 1 (folder is in My Drive, not a Shared Drive)')
