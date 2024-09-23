import { FlagrightRegion, Stage } from './deploy'

export const siloDataTenants: Partial<
  Record<Stage, Partial<Record<FlagrightRegion, string[]>>>
> = {
  dev: {
    'eu-1': ['silo-flagright-dev'],
  },
}
