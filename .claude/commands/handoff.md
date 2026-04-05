Generate a complete session handoff for the next conversation.

## Steps

### 1. Gather session data
- Run `git log --oneline` since the last session's final commit (check memory for previous session state)
- Run `npm test -- --run` to get current test count
- Run `npx tsc --noEmit` to confirm zero TS errors
- Count total commits this session

### 2. Update project memory
Update `~/.claude/projects/-Users-gregkelsch-microgrid-crm/memory/project_sales_portal.md` with:
- Session number and date
- Summary of what was built (one line per feature)
- Current stats: test count, commit count, latest commit hash
- Final audit scores if protocol was run
- Any SQL migrations that were applied
- Remaining work / blocked items / next priorities

### 3. Update MEMORY.md
If any new memory files were created this session, ensure they're indexed in MEMORY.md.

### 4. Write handoff note
Output a formatted handoff note for Greg to paste into the next session. Include:
- Repo path and live URL
- Test count and latest commit
- "Read first" list of files
- What was built this session (bulleted)
- Blocked/waiting items
- Priority for next session
- Standing rules reminder

### 5. Final check
Confirm everything is committed and pushed. No uncommitted changes should remain.

## Format
Use the exact format Greg used for previous handoffs (check session memory files for examples).
