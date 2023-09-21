import {
  getDrsAndKrsScoreDetials,
  sampleBusinessUserRiskScoreComponents,
  sampleConsumerUserRiskScoreComponents,
} from '../samplers/risk_score_components'
import { data as users } from './users'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

const drsScores: DrsScore[] = []
const krsScores: KrsScore[] = []

const init = () => {
  if (drsScores.length > 0 || krsScores.length > 0) {
    return
  }
  users.forEach((user) => {
    const components =
      user.type === 'BUSINESS'
        ? sampleBusinessUserRiskScoreComponents(user)
        : sampleConsumerUserRiskScoreComponents(user)

    const data = getDrsAndKrsScoreDetials(components, user.userId)

    user.krsScore = data.krsScore
    user.drsScore = data.drsScore
    drsScores.push(data.drsScore)
    krsScores.push(data.krsScore)
  })
}

export { init, drsScores, krsScores }
