import { removePrefixFromName } from '../transaction-rule-utils'

describe('removePrefixFromName', () => {
  test('should remove prefix from name', () => {
    const name = 'Mr. John Doe'
    const result = removePrefixFromName(name)
    expect(result).toBe('John Doe')
  })

  test('should remove prefix from name and convert to lowercase', () => {
    const name = 'Ms. Jane Smith'
    const result = removePrefixFromName(name, true)
    expect(result).toBe('jane smith')
  })

  test('should not remove prefix if it is not present', () => {
    const name = 'John Doe'
    const result = removePrefixFromName(name)
    expect(result).toBe('John Doe')
  })

  test('should handle empty name', () => {
    const name = ''
    const result = removePrefixFromName(name)
    expect(result).toBe('')
  })
})
