import { isValidEmail } from '@flagright/lib/utils'
import { checkIfWebsite, removePunctuation } from '../regex'

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

  test('Remove punctuation', () => {
    const input = 'This is a test \\This is a test.'
    const expected = 'This is a test This is a test'

    expect(removePunctuation(input)).toBe(expected)
  })
})

describe('Website validation', () => {
  test('Valid website with http protocol', () => {
    const website = 'http://example.com'
    expect(checkIfWebsite(website)).toBe(true)
  })

  test('Valid website with https protocol', () => {
    const website = 'https://example.com'
    expect(checkIfWebsite(website)).toBe(true)
  })

  test('Valid website without protocol', () => {
    const website = 'example.com'
    expect(checkIfWebsite(website)).toBe(true)
  })

  test('Valid website with subdomain', () => {
    const website = 'https://sub.example.com'
    expect(checkIfWebsite(website)).toBe(true)
  })

  test('Invalid website without top level domain', () => {
    const website = 'https://example'
    expect(checkIfWebsite(website)).toBe(false)
  })

  test('Invalid website with spaces', () => {
    const website = 'https://exa mple.com'
    expect(checkIfWebsite(website)).toBe(false)
  })

  test('Invalid website with special characters', () => {
    const website = 'https://exa$mple.com'
    expect(checkIfWebsite(website)).toBe(false)
  })
})
