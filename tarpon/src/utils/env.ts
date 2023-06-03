export function envIs(env: 'dev' | 'sandbox' | 'prod') {
  if (!process.env.ENV) {
    // We don't know, return false to be safe.
    return false
  }
  return process.env.ENV.startsWith(env)
}
export function envIsNot(env: 'dev' | 'sandbox' | 'prod') {
  if (!process.env.ENV) {
    // We don't know, return false to be safe.
    return false
  }
  return !process.env.ENV.startsWith(env)
}
