import { ruleSimulation } from './raw-data/simulation-rules'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'

const data: SimulationBeaconJob[] = ruleSimulation

const init = () => undefined

export { init, data }
