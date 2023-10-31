export const PRODUCTION_ENVS: Env[] = [
  'prod:asia-1',
  'prod:asia-2',
  'prod:eu-1',
  'prod:eu-2',
  'prod:au-1',
  'prod:us-1',
]

export type Env =
  | 'test'
  | 'local'
  | 'dev'
  | 'sandbox'
  | 'prod'
  | 'prod:asia-1'
  | 'prod:asia-2'
  | 'prod:eu-1'
  | 'prod:eu-2'
  | 'prod:au-1'
  | 'prod:us-1'

export type FlagrightRegion =
  | 'eu-1'
  | 'asia-1'
  | 'asia-2'
  | 'us-1'
  | 'eu-2'
  | 'au-1'

export type Stage = 'local' | 'dev' | 'sandbox' | 'prod'

export function envIs(...envs: Env[]) {
  return envs.some((env) => {
    if (env === 'local' && process.env.NODE_ENV === 'test') {
      return false
    }

    if (env === 'test') {
      return process.env.NODE_ENV === 'test'
    }

    if (!process.env.ENV) {
      // We don't know, return false to be safe.
      return false
    }
    return process.env.ENV.startsWith(env)
  })
}

export function envIsNot(...envs: Env[]) {
  return !envs.some((env) => envIs(env))
}
