import memoize from 'lodash/memoize'
import { getAccounts } from '../samplers/accounts'
import {
  ID_PREFIXES,
  TIME_BACK_TO_3_MONTH_WINDOW,
  VERSION_HISTORY_SEED,
} from './seeds'
import { riskFactors } from './risk-factors'
import { VersionHistory } from '@/@types/openapi-internal/VersionHistory'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'

const VERSION_HISTORY_COUNT = 20
let riskClassificationCounter = 1
let riskFactorsCounter = 1

const generateRandomRiskScoreBounds = (rng: RandomNumberGenerator) => {
  const splitPoints = [0, 100]
  for (let i = 0; i < 3; i++) {
    splitPoints.push(rng.randomIntInclusive(1, 99))
  }
  splitPoints.sort((a, b) => a - b)
  const uniquePoints = [...new Set(splitPoints)]
  while (uniquePoints.length < 5) {
    const newPoint = rng.randomIntInclusive(1, 99)
    if (!uniquePoints.includes(newPoint)) {
      uniquePoints.push(newPoint)
    }
  }
  uniquePoints.sort((a, b) => a - b)
  const bounds = uniquePoints.slice(0, 5)
  bounds[0] = 0
  bounds[4] = 100
  return [
    {
      riskLevel: 'VERY_LOW' as RiskLevel,
      lowerBoundRiskScore: bounds[0],
      upperBoundRiskScore: bounds[1],
    },
    {
      riskLevel: 'LOW' as RiskLevel,
      lowerBoundRiskScore: bounds[1],
      upperBoundRiskScore: bounds[2],
    },
    {
      riskLevel: 'MEDIUM' as RiskLevel,
      lowerBoundRiskScore: bounds[2],
      upperBoundRiskScore: bounds[3],
    },
    {
      riskLevel: 'HIGH' as RiskLevel,
      lowerBoundRiskScore: bounds[3],
      upperBoundRiskScore: bounds[4],
    },
    {
      riskLevel: 'VERY_HIGH' as RiskLevel,
      lowerBoundRiskScore: bounds[4],
      upperBoundRiskScore: 100,
    },
  ]
}
const generator = function* (): Generator<VersionHistory> {
  const rng = new RandomNumberGenerator(VERSION_HISTORY_SEED)

  for (let i = 0; i < VERSION_HISTORY_COUNT; i += 1) {
    //RiskClassification
    if (i % 2 === 0) {
      const id = `${ID_PREFIXES.RLV}${riskClassificationCounter++}`
      yield {
        id,
        type: 'RiskClassification',
        data: generateRandomRiskScoreBounds(rng.r(i)),
        comment: 'Risk classification updated',
        createdAt: rng.randomTimestamp(TIME_BACK_TO_3_MONTH_WINDOW),
        updatedAt: rng.randomTimestamp(TIME_BACK_TO_3_MONTH_WINDOW),
        createdBy: rng.r(1).pickRandom(getAccounts()).id,
      }
    } else {
      //RiskFactors
      const riskFactor = riskFactors()[rng.r(1).randomInt(riskFactors().length)]
      const versionHistory: VersionHistory = {
        id: `${ID_PREFIXES.RFV}${riskFactorsCounter++}`,
        data: [riskFactor],
        type: 'RiskFactors',
        comment: 'Risk factor updated',
        createdAt: rng.randomTimestamp(TIME_BACK_TO_3_MONTH_WINDOW),
        updatedAt: rng.randomTimestamp(TIME_BACK_TO_3_MONTH_WINDOW),
        createdBy: rng.r(1).pickRandom(getAccounts()).id,
      }
      yield versionHistory
    }
  }
}

const generate: () => Iterable<VersionHistory> = () => generator()

export const versionHistory: () => VersionHistory[] = memoize(() => {
  return [...generate()]
})
