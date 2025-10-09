import memoize from 'lodash/memoize'
import { getConfig } from '../../../scripts/migrations/utils/config'

export const getApiBasePath = memoize(() => {
  const config = getConfig()
  return process.env.DOMAIN ?? config.application.AUTH0_AUDIENCE.slice(0, -1)
})

export const getIncorrectApiBasePath = memoize(() => {
  const config = getConfig()
  return config.stage === 'dev'
    ? 'https://sandbox.api.flagright.com'
    : 'https://api.flagright.dev'
})
