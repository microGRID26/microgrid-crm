// Smoke test — verifies Jest + jest-expo preset are wired before the real test
// suite is built out. Catches "Jest can't even start" regressions during Phase 2.

describe('jest baseline', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })

  it('has truthy globals from jest-expo preset', () => {
    expect(typeof __DEV__).toBe('boolean')
  })
})
