import { FlagrightRegion, Stage } from './deploy'

// Don't end with -test
export const siloDataTenants: Partial<
  Record<Stage, Partial<Record<FlagrightRegion, string[]>>>
> = {
  dev: {
    'eu-1': ['silo-flagright-dev'],
  },
  sandbox: {
    'asia-1': ['pnb-uat'],
  },
  prod: {
    'asia-1': ['pnb', 'pnb-stress'],
  },
}
