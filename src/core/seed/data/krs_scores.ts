import { data as users } from './users'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { pickRandom, randomFloat } from '@/utils/prng'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'

let data: KrsScore[] = []
const init = () => {
  if (data.length > 0) {
    return
  }
  data = users.map((u, i): KrsScore => {
    return {
      createdAt: sampleTimestamp(i),
      krsScore: randomFloat(i),
      userId: u.userId,
      riskLevel: pickRandom(RISK_LEVEL1S),
    }
  })
}

export { init, data }
