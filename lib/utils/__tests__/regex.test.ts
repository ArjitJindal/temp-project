import { isValidEmail } from '../regex'

describe('isValidEmail', () => {
  it('should return true for a valid email', () => {
    const validEmails = [
      'test@example.com',
      'john.doe@example.co.uk',
      'john.doe@example.flagright.co.uk',
      'jane_doe123@example.com',
    ]

    validEmails.forEach((email) => {
      expect(isValidEmail(email)).toBe(true)
    })
  })

  it('should return false for an invalid email', () => {
    const invalidEmails = [
      'test@example',
      'john.doe@example.',
      'jane_doe123@example',
      'test@.com',
      'test@',
      '@example.com',
      'test@com.',
    ]

    invalidEmails.forEach((email) => {
      expect(isValidEmail(email)).toBe(false)
    })
  })
})
