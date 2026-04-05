Run a standalone security and code quality audit on the codebase or a specific area.

Usage: `/audit` (full codebase) or `/audit [area]` (e.g., `/audit sparksign`, `/audit api routes`)

## Steps

### 1. Determine scope
- If no argument: audit everything changed since last audit or last 5 commits
- If argument provided: audit that specific area/feature

### 2. Launch thorough audit
Use an Explore agent with "very thorough" thoroughness. Check:

**Security (weight: 40%)**
- Auth on every endpoint (who can access what?)
- Input validation (email, UUID, lengths, types, bounds)
- Injection vectors (SQL, XSS, command)
- Race conditions (double-submit, concurrent writes)
- Rate limiting (per-IP, per-user, per-resource)
- Data leakage (are responses scoped correctly?)
- Secrets (anything hardcoded that shouldn't be?)

**Code Quality (weight: 25%)**
- `as any` casts (count them, are they justified?)
- Error handling (try-catch, user-facing error messages)
- Type safety (nullable fields handled?)
- Dead code (unused exports, commented blocks)

**Performance (weight: 15%)**
- N+1 queries (loops with DB calls inside)
- Missing `.limit()` on queries
- Unbounded arrays or maps
- Large file sizes (>600 lines)

**Architecture (weight: 10%)**
- Patterns match existing codebase
- API layer used consistently (no raw supabase in pages)
- Constants centralized
- Types shared (no duplicate interfaces)

**UX (weight: 10%)**
- Loading states on async operations
- Error states (what does the user see on failure?)
- Empty states
- Mobile responsiveness (sm: breakpoints)

### 3. Grade using rubric
Count issues by severity (Critical/High/Medium/Low). Apply rubric:
- **A**: No high/critical, < 5 medium
- **B**: No critical, < 3 high, < 10 medium
- **C**: No critical, < 5 high, any medium
- **D**: Critical present OR > 5 high
- **F**: Multiple unmitigated critical

### 4. Report
Output:
1. Grade with issue counts
2. Numbered table of ALL issues (severity, description, file:line)
3. Explain each issue with a real-world analogy
4. Recommended fix priority order

## Rules
- Be thorough — missed issues are worse than false positives
- Be honest — don't inflate or deflate grades
- Use the exact rubric every time for consistency across sessions
- Explain with analogies per Greg's preference
