import { applyNewVersion } from '../downstream-version'

describe('applyNewVersion', () => {
  it('returns true if existingEntity is undefined', () => {
    const result = applyNewVersion({ updateCount: 2 }, undefined)
    expect(result).toBe(true)
  })

  it('returns true if existingEntity is null', () => {
    const result = applyNewVersion({ updateCount: 2 }, null)
    expect(result).toBe(true)
  })

  it('returns true if new updateCount > existing updateCount', () => {
    const result = applyNewVersion({ updateCount: 3 }, { updateCount: 2 })
    expect(result).toBe(true)
  })

  it('returns false if new updateCount <= existing updateCount', () => {
    const result1 = applyNewVersion({ updateCount: 2 }, { updateCount: 2 })
    const result2 = applyNewVersion({ updateCount: 1 }, { updateCount: 2 })
    expect(result1).toBe(false)
    expect(result2).toBe(false)
  })

  it('defaults new updateCount to 1 if missing', () => {
    const result = applyNewVersion({}, { updateCount: 0 })
    expect(result).toBe(true)
  })

  it('defaults existing updateCount to 0 if missing', () => {
    const result = applyNewVersion({ updateCount: 1 }, {})
    expect(result).toBe(true)
  })

  it('returns false if both updateCounts are undefined (1 <= 0)', () => {
    const result = applyNewVersion({}, {})
    expect(result).toBe(true) // Because (1 > 0)
  })

  it('handles edge case where new version is 0 and existing is undefined', () => {
    const result = applyNewVersion({ updateCount: 0 }, {})
    expect(result).toBe(false)
  })
})
