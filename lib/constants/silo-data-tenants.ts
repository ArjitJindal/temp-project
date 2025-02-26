import { FlagrightRegion, Stage } from './deploy'

export enum SiloDataTenantAlias {
  PNB_SIT = '7fd46ed8d7',
  PNB = 'pnb',
  PNB_STRESS = 'pnb-stress',
  DEV = 'silo-flagright-dev',
}

// Don't end with -test
export const siloDataTenants: Partial<
  Record<Stage, Partial<Record<FlagrightRegion, string[]>>>
> = {
  dev: {
    'eu-1': [SiloDataTenantAlias.DEV],
  },
  sandbox: {
    'asia-1': [SiloDataTenantAlias.PNB_SIT],
  },
  prod: {
    'asia-1': [SiloDataTenantAlias.PNB, SiloDataTenantAlias.PNB_STRESS],
  },
}
