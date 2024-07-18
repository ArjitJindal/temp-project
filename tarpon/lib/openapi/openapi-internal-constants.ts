// NOTE: For white-label customers, add their console URLs here
import {
  BRANDING_CONFIG,
  BrandingConsoleEnvSettings,
} from '../../../lib/config/config-branding'
import { notEmpty } from '@/utils/array'

const sanitize = (url: string) => {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function getWhitelabelOrigins(consoleSettings: BrandingConsoleEnvSettings): {
  [key in 'sandbox' | 'prod']: string
} {
  return {
    sandbox: `https://${consoleSettings.sandbox.host}`,
    prod: `https://${consoleSettings.prod.host}`,
  }
}

// BRANDING_CONFIG
export const WHITE_LABEL_ORIGINS = {
  regtank: getWhitelabelOrigins(BRANDING_CONFIG.REGTANK.consoleSettings),
  traxionRight: getWhitelabelOrigins(
    BRANDING_CONFIG.TRAXIONRIGHT.consoleSettings
  ),
}

export const ALLOWED_ORIGINS = {
  dev: ['*'],
  sandbox: [
    'https://sandbox.console.flagright.com',
    ...Object.values(WHITE_LABEL_ORIGINS).map((v) => v.sandbox),
  ]
    .filter(notEmpty)
    .map(sanitize),
  prod: [
    'https://console.flagright.com',
    'https://asia-1.console.flagright.com',
    'https://asia-2.console.flagright.com',
    'https://eu-1.console.flagright.com',
    ...Object.values(WHITE_LABEL_ORIGINS).map((v) => v.prod),
  ]
    .filter(notEmpty)
    .map(sanitize),
}
