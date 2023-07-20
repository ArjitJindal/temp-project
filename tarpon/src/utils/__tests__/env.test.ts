import { envIs, envIsNot } from '../env'

describe('env', () => {
  test('envIs returns true', async () => {
    const originalEnv = process.env.ENV
    process.env.ENV = 'development'
    expect(envIs('sandbox', 'prod')).toBeFalsy()
    process.env.ENV = originalEnv
  })
  test('envIs returns false', async () => {
    const originalEnv = process.env.ENV
    process.env.ENV = 'dev'
    expect(envIs('sandbox', 'dev')).toBeTruthy()
    process.env.ENV = originalEnv
  })
  test('envIsNot returns true', async () => {
    const originalEnv = process.env.ENV
    process.env.ENV = 'development'
    expect(envIsNot('sandbox', 'prod')).toBeTruthy()
    process.env.ENV = originalEnv
  })
  test('envIsNot returns false', async () => {
    const originalEnv = process.env.ENV
    process.env.ENV = 'dev'
    expect(envIsNot('sandbox', 'dev')).toBeFalsy()
    process.env.ENV = originalEnv
  })
})
