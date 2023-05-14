import { data as users } from './users'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { pickRandom, randomFloat } from '@/utils/prng'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'

let data: DrsScore[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  data = users.map((u, i): DrsScore => {
    return {
      createdAt: sampleTimestamp(i),
      userId: u.userId,
      derivedRiskLevel: pickRandom(RISK_LEVEL1S),
      drsScore: randomFloat(i * 2),
      isUpdatable: true,
    }
  })
}

export { init, data }
