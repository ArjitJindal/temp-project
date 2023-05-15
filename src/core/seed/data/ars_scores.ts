import { transactions } from './transactions'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { pickRandom, randomFloat } from '@/utils/prng'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'

const data: ArsScore[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  transactions.map((t) => {
    data.push({
      createdAt: sampleTimestamp(0.1),
      destinationUserId: t.destinationUserId,
      originUserId: t.originUserId,
      riskLevel: pickRandom(RISK_LEVEL1S),
      arsScore: randomFloat(100),
    })
  })
}

export { data, init }
