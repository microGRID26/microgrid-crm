Get oriented at the start of a session. Read all context, verify codebase health, report status.

## Steps

### 1. Read context files
- Read `CLAUDE.md` (project instructions)
- Read `~/.claude/projects/-Users-gregkelsch-microgrid-crm/memory/project_sales_portal.md` (project state)
- Read `~/.claude/projects/-Users-gregkelsch-microgrid-crm/memory/feedback_audit_rubric.md` (audit rubric)
- Read `~/.claude/projects/-Users-gregkelsch-microgrid-crm/memory/feedback_self_prompt_protocol.md` (working rules)
- Read `~/.claude/projects/-Users-gregkelsch-microgrid-crm/memory/feedback_straight_talk.md` (communication style)

### 2. Check codebase health
- Run `git log --oneline -5` (recent commits)
- Run `git status` (uncommitted changes)
- Run `npm test -- --run` (test count + pass/fail)
- Run `npx tsc --noEmit` (type errors)

### 3. Report
Output a concise status report:
- Current branch and latest commit
- Test count and pass status
- TS error count
- Any uncommitted changes
- Last session summary (from memory)
- Blocked items (from memory)
- Suggested priorities for this session

### 4. Ask
Ask Greg what he wants to work on today.

## Rules
- Keep the report under 20 lines. Greg doesn't need a novel.
- If tests fail or TS errors exist, flag them prominently.
- Don't start working until Greg says what to do.
