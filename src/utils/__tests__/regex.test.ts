import { isValidEmail } from '../regex'

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
