import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import { envIsNot } from '../env'
import { hasFeature } from '@/core/utils/context'

export function isClickhouseEnabled() {
  return hasFeature('CLICKHOUSE_ENABLED') && isClickhouseEnabledInRegion()
}

export function isClickhouseMigrationEnabled() {
  return isClickhouseEnabledInRegion() && hasFeature('CLICKHOUSE_MIGRATION')
}
export function isConsoleMigrationEnabled() {
  return isClickhouseEnabledInRegion() && hasFeature('CONSOLE_MIGRATION')
}
export const isClickhouseEnabledInRegion = () => {
  if (envIsNot('prod')) {
    return true
  }

  const [stage, region] = stageAndRegion()

  const config = getTarponConfig(stage, region)
  return !!config.clickhouse
}
