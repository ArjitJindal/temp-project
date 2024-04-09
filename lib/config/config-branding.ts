import BRANDING_CONFIG_JSON from './config-branding-json.json'

export type BrandId = keyof typeof BRANDING_CONFIG_JSON
export type BrandingConsoleSettings = {
  allowedDomains: string[]
  host: string
  auth0Domain: string
  auth0ClientId: string
}
export type BrandingConsoleEnvSettings = {
  [url in 'prod' | 'sandbox']: BrandingConsoleSettings
}
export type BrandingConfigItem = {
  consoleSettings: BrandingConsoleEnvSettings
}
export type BrandingConfigType = { [key in BrandId]: BrandingConfigItem }

export const BRANDING_CONFIG: BrandingConfigType = BRANDING_CONFIG_JSON
