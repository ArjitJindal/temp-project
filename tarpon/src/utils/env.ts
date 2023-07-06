type Env = 'test' | 'local' | 'dev' | 'sandbox' | 'prod'
export function envIs(env: Env) {
  if (env === 'test') {
    return process.env.NODE_ENV === 'test'
  }

  if (!process.env.ENV) {
    // We don't know, return false to be safe.
    return false
  }
  return process.env.ENV.startsWith(env)
}
export function envIsNot(env: Env) {
  return !envIs(env)
}
