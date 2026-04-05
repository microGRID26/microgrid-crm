Run the full build protocol. This is mandatory after every feature build — no exceptions.

## Steps (execute in exact order)

### 1. Tests
Run `npm test -- --run` and `npx tsc --noEmit`. Report pass count and any failures. If tests fail, fix them before proceeding.

### 2. R1 Audit
Launch an Explore agent to do a thorough audit of all code changed this session. Check:
- **Security**: auth, input validation, injection, race conditions, rate limiting, data leakage
- **Code quality**: error handling, type safety, as any casts, dead code
- **Performance**: N+1 queries, missing limits, memory leaks
- **UX**: loading states, error states, empty states, mobile responsiveness
- **Architecture**: patterns match existing codebase, no duplicate code

### 3. Grade (use exact rubric)
Count issues by severity:
- **Critical**: Exploitable vulnerability, data loss risk, or complete feature failure
- **High**: Significant bug, security gap, or pattern that will cause production issues
- **Medium**: Code smell, inconsistency, or minor gap that degrades quality but doesn't break things
- **Low**: Nitpick, style preference, or improvement that's nice-to-have

Grade:
- **A**: No high/critical issues, < 5 medium
- **B**: No critical issues, < 3 high, < 10 medium
- **C**: No critical issues, < 5 high, any medium
- **D**: Critical issues present OR > 5 high
- **F**: Multiple unmitigated critical issues

Show the count alongside the grade. No +/- modifiers.

### 4. List ALL Issues
Present a numbered table: #, severity, issue description, file:line, fix description. Use real-world analogies for each issue per Greg's preference.

### 5. Fix ALL Issues
Fix every issue found — critical through low. No skipping.

### 6. R2 Audit
Re-verify every R1 issue is fixed. Report status per issue (FIXED/OPEN). Grade again.

### 7. Update Docs
Update CLAUDE.md: test count, any new features/pages/API routes/known issues. Update session memory if applicable.

### 8. Report
Show final grade, test count, TS error count, and summary of what was fixed.

## Rules
- NEVER skip R2. Greg enforces this strictly.
- NEVER inflate grades. Grade on absolute state, not delta from previous.
- Always explain fixes with real-world analogies.
- If R2 finds new issues, fix them and run R3. Loop until grade is A.
