import { REGEX_MATCH_OPERATOR, NOT_REGEX_MATCH_OPERATOR } from '../regex-match'

describe('Regex Matching Operators', () => {
  describe('Email Regex Validation', () => {
    const emailRegex = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$'

    const validEmails = [
      'user@example.com',
      'firstname.lastname@domain.co.uk',
      'user+tag@example.org',
      'user123@sub.domain.com',
    ]

    const invalidEmails = [
      'invalid-email',
      '@missing-username.com',
      'missing-domain@',
      'spaces in@email.com',
      'no-at-symbol.com',
      '@.',
      'multiple@@at.com',
    ]

    test.each(validEmails)('should match valid email: %s', async (email) => {
      const result = await REGEX_MATCH_OPERATOR.run(email, emailRegex)
      expect(result).toBe(true)
    })

    test.each(invalidEmails)(
      'should not match invalid email: %s',
      async (email) => {
        const result = await REGEX_MATCH_OPERATOR.run(email, emailRegex)
        expect(result).toBe(false)
      }
    )
  })

  describe('Phone Number Regex Validation', () => {
    const phoneRegex =
      '^(\\+\\d{1,3}[- ]?)?\\(?\\d{3}\\)?[- ]?\\d{3}[- ]?\\d{4}$'

    const validPhoneNumbers = [
      '1234567890',
      '123-456-7890',
      '(123)456-7890',
      '+1 (123) 456-7890',
    ]

    const invalidPhoneNumbers = [
      '123',
      '12345',
      'abcdefghij',
      '+1 (123) 45-678',
      '123-45-6789',
      '(123)4567-890',
    ]

    test.each(validPhoneNumbers)(
      'should match valid phone number: %s',
      async (phone) => {
        const result = await REGEX_MATCH_OPERATOR.run(phone, phoneRegex)
        expect(result).toBe(true)
      }
    )

    test.each(invalidPhoneNumbers)(
      'should not match invalid phone number: %s',
      async (phone) => {
        const result = await REGEX_MATCH_OPERATOR.run(phone, phoneRegex)
        expect(result).toBe(false)
      }
    )
  })

  describe('Name Regex Validation', () => {
    const nameRegex = "^[a-zA-Z]+([\\s-'][a-zA-Z]+)*$"

    const validNames = [
      'John Doe',
      'Mary-Jane Smith',
      "O'Connor",
      'Jean-Pierre',
      'Anna Maria',
    ]

    const invalidNames = [
      '123 Name',
      'Name123',
      'Na-me1',
      '@Special',
      'Name with numbers 123',
      '',
    ]

    test.each(validNames)('should match valid name: %s', async (name) => {
      const result = await REGEX_MATCH_OPERATOR.run(name, nameRegex)
      expect(result).toBe(true)
    })

    test.each(invalidNames)(
      'should not match invalid name: %s',
      async (phone) => {
        const result = await REGEX_MATCH_OPERATOR.run(phone, nameRegex)
        expect(result).toBe(false)
      }
    )
  })

  describe('Complex Regex Edge Cases', () => {
    test('should handle null or undefined input', async () => {
      const resultNull = await REGEX_MATCH_OPERATOR.run(null, '.*')
      const resultUndefined = await REGEX_MATCH_OPERATOR.run(undefined, '.*')

      expect(resultNull).toBe(false)
      expect(resultUndefined).toBe(false)
    })

    describe('Not Regex Match Operator', () => {
      test('should negate regex match', async () => {
        const result = await NOT_REGEX_MATCH_OPERATOR.run('test123', '^[a-z]+$')
        expect(result).toBe(true)
      })

      test('should return false for matching input', async () => {
        const result = await NOT_REGEX_MATCH_OPERATOR.run('test', '^[a-z]+$')
        expect(result).toBe(false)
      })
    })

    test('should handle long input strings', async () => {
      const longString = 'a'.repeat(100)
      const result = await REGEX_MATCH_OPERATOR.run(longString, '^a+$')
      expect(result).toBe(true)
    })
  })
})
