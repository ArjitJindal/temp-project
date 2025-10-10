import memoize from 'lodash/memoize'
import { getRuleSimulation } from '../raw-data/simulation-rules'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'

export const getSimulations: () => SimulationBeaconJob[] = memoize(() => {
  return getRuleSimulation()
})
