import { Stage } from '@flagright/lib/constants/deploy'

type AtlasConfig = {
  searchEnabled: boolean
  region: string
  project: string
  cluster: string
}

export function getAtlasTenantConfig(stage: Stage): AtlasConfig[] {
  switch (stage) {
    case 'dev': {
      return [
        {
          region: 'eu-1',
          searchEnabled: true,
          project: 'Tarpon-Dev',
          cluster: 'Cluster0',
        },
      ]
    }

    case 'sandbox': {
      return [
        {
          region: 'eu-1',
          searchEnabled: true,
          project: 'Tarpon-Sandbox',
          cluster: 'Sandbox',
        },
        {
          region: 'asia-1',
          searchEnabled: true,
          project: 'Tarpon-Sandbox',
          cluster: 'Sandbox-SIN',
        },
      ]
    }

    case 'prod': {
      return [
        {
          region: 'asia-1',
          searchEnabled: true,
          project: 'Tarpon-Production',
          cluster: 'Prod-SIN',
        },
      ]
    }

    default: {
      return []
    }
  }
}
