import { Env } from '@flagright/lib/constants/deploy'

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
