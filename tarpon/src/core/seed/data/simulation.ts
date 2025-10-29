import memoize from 'lodash/memoize'
import { getRuleSimulation } from '../raw-data/simulation-rules'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'
import { V8RiskSimulationJob } from '@/@types/openapi-internal/V8RiskSimulationJob'

export const getSimulations: () =>
  | (SimulationBeaconJob & { _id: string })[]
  | (V8RiskSimulationJob & { _id: string })[]
  | V8RiskSimulationJob[] = memoize(() => {
  return getRuleSimulation() as
    | (SimulationBeaconJob & { _id: string })[]
    | (V8RiskSimulationJob & { _id: string })[]
})
