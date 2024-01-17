import { isValidEmail, removePunctuation } from '../regex'

describe('Email validation', () => {
  test('Valid email', () => {
    const email = 'test@abc.com'
    expect(isValidEmail(email)).toBe(true)
  })
  test('Invalid email', () => {
    const email = 'test'
    expect(isValidEmail(email)).toBe(false)
  })

  test('Subdomain email', () => {
    const email = 'test@abc.cde.com'
    expect(isValidEmail(email)).toBe(true)
  })
})

describe('Remove punctuation', () => {
  test('Remove punctuation', () => {
    const input = 'This is a test. This is a test.'
    const expected = 'This is a test This is a test'
    expect(removePunctuation(input)).toBe(expected)
  })

  test('Remove punctuation', () => {
    const input = 'This is a test, This is a test.'
    const expected = 'This is a test This is a test'
    expect(removePunctuation(input)).toBe(expected)
  })

  test('Remove punctuation', () => {
    const input = 'This is a test! This is a test.'
    const expected = 'This is a test This is a test'
    expect(removePunctuation(input)).toBe(expected)
  })

  test('Remove punctuation', () => {
    const input = 'This is a test? This is a test.'
    const expected = 'This is a test This is a test'
    expect(removePunctuation(input)).toBe(expected)
  })
})
