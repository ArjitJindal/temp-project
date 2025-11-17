import { CONFIG_MAP } from './config'

export type Stage = keyof typeof CONFIG_MAP
export type DeployStage = 'dev' | 'sandbox' | 'prod'
export type FlagrightRegion = keyof (typeof CONFIG_MAP)['prod']
export const SANDBOX_REGIONS: FlagrightRegion[] = Object.keys(
  CONFIG_MAP['sandbox']
) as FlagrightRegion[]
export const PRODUCTION_REGIONS: FlagrightRegion[] = Object.keys(
  CONFIG_MAP['prod']
) as FlagrightRegion[]

export const DEPLOY_STAGES: DeployStage[] = ['dev', 'sandbox', 'prod']
export type ExtendedFlagrightRegion = FlagrightRegion | 'asia-2'
export type Env = Stage | `${Stage}:${FlagrightRegion}`

/**
 * Maps Flagright regions to AWS region codes
 */
export const FLAGRIGHT_TO_AWS_REGION: Record<FlagrightRegion, string> = {
  'asia-1': 'ap-southeast-1',
  // 'asia-2': 'ap-south-1', // Commented out as we don't support it anymore
  'asia-3': 'ap-east-1',
  'au-1': 'ap-southeast-2',
  'eu-1': 'eu-central-1',
  'eu-2': 'eu-west-2',
  'me-1': 'me-central-1',
  'us-1': 'us-west-2',
}

/**
 * Gets AWS Secrets Manager replica regions based on deployment stage
 * The primary region is always eu-central-1, these are the replicas
 *
 * @param stage - The deployment stage (dev, sandbox, prod)
 * @returns Array of AWS region codes to replicate secrets to
 */
export function getSecretsManagerReplicaRegions(stage: DeployStage): string[] {
  switch (stage) {
    case 'dev':
      // Dev only has eu-central-1, no replicas needed
      return []
    case 'sandbox':
      // Sandbox has eu-central-1 (primary) and asia-1, so replicate to asia-1
      return [FLAGRIGHT_TO_AWS_REGION['asia-1']]
    case 'prod':
      // Prod has all regions, replicate to all except eu-central-1 (primary)
      return PRODUCTION_REGIONS.filter((region) => region !== 'eu-1') // eu-1 is the primary
        .map((region) => FLAGRIGHT_TO_AWS_REGION[region])
    default:
      return []
  }
}
