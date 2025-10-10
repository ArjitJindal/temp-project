import { LogicVariableContext } from '../types'
import { TRANSACTION_TRS_SCORE } from '../trs-score'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])

test('Transaction TRS score: no risk score details', async () => {
  const transaction = { riskScoreDetails: undefined }
  const trsScore = await TRANSACTION_TRS_SCORE.load(
    transaction,
    {} as LogicVariableContext
  )
  expect(trsScore).toBe(90)
})

test('Transaction TRS score: with risk score details', async () => {
  const transaction = {
    riskScoreDetails: { trsScore: 100, trsRiskLevel: 'LOW' as const },
  }
  const trsScore = await TRANSACTION_TRS_SCORE.load(
    transaction,
    {} as LogicVariableContext
  )
  expect(trsScore).toBe(100)
})

test('Transaction TRS score: with risk score details and no risk level', async () => {
  const transaction = {
    transactionId: '1',
  }
  const scoreIsFetched = jest.spyOn(RiskRepository.prototype, 'getArsScore')
  const trsScore = await TRANSACTION_TRS_SCORE.load(
    transaction,
    {} as LogicVariableContext
  )

  expect(scoreIsFetched).toBeCalledTimes(1)
  expect(trsScore).toBe(90)
})
