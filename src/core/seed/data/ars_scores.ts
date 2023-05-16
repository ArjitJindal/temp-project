import { transactions } from './transactions'
import { pickRandom, randomFloat } from '@/utils/prng'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'

const data: ArsScore[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  transactions.map((t) => {
    const score: ArsScore = {
      transactionId: t.transactionId,
      createdAt: t.timestamp,
      destinationUserId: t.destinationUserId,
      originUserId: t.originUserId,
      riskLevel: pickRandom(RISK_LEVEL1S),
      arsScore: randomFloat(100),
    }
    data.push(score)
  })
}

export { data, init }
