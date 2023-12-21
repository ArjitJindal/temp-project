import { CONFIG_MAP } from './config'

export type Stage = keyof typeof CONFIG_MAP
export type FlagrightRegion = keyof (typeof CONFIG_MAP)['prod']
export const PRODUCTION_REGIONS: FlagrightRegion[] = Object.keys(
  CONFIG_MAP['prod']
) as FlagrightRegion[]

export type Env = Stage | `${Stage}:${FlagrightRegion}`
