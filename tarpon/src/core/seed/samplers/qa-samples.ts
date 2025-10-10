import memoize from 'lodash/memoize'
import shuffle from 'lodash/shuffle'
import { QA_SAMPLES_SEED } from '../data/seeds'
import { getAlerts } from '@/core/seed/data/alerts'
import { getAccounts } from '@/core/seed/samplers/accounts'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'

export const getQASamples = memoize(() => {
  const rng = new RandomNumberGenerator(QA_SAMPLES_SEED)

  const alerts = getAlerts()

  const filteredAlerts = alerts.filter(
    (alert) => alert.alertStatus === 'CLOSED' && !alert.ruleQaStatus
  )

  const percentage = 40

  const _40PercentOfAlerts = shuffle(
    filteredAlerts.map((alert) => alert.alertId as string)
  ).slice(0, (percentage / 100) * filteredAlerts.length)

  let sampleCount = 1

  const autoSample: AlertsQaSampling = {
    createdBy: rng.pickRandom(getAccounts()).id,
    createdAt: Date.now(),
    priority: rng.r(1).pickRandom(PRIORITYS),
    samplingName: 'First QA Sample',
    samplingDescription: `This is a QA sample of ${percentage}% of the closed alerts`,
    updatedAt: Date.now(),
    alertIds: _40PercentOfAlerts,
    samplingId: `S-${sampleCount++}`,
    samplingType: 'AUTOMATIC',
    samplingQuantity: _40PercentOfAlerts.length,
  }

  const manualAlerts = shuffle(
    filteredAlerts.map((alert) => alert.alertId as string)
  ).slice(0, 5)

  const manualSample: AlertsQaSampling = {
    createdBy: rng.r(2).pickRandom(getAccounts()).id,
    createdAt: Date.now(),
    priority: rng.r(3).pickRandom(PRIORITYS),
    samplingName: 'Second QA Sample (Manual)',
    samplingDescription: `This is a QA sample of ${percentage}% of the closed alerts`,
    updatedAt: Date.now(),
    alertIds: manualAlerts,
    samplingId: `S-${sampleCount++}`,
    samplingType: 'MANUAL',
    manuallyAdded: manualAlerts,
    samplingQuantity: manualAlerts.length,
  }

  return [autoSample, manualSample]
})
