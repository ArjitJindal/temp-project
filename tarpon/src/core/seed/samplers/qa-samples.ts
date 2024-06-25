import { memoize, shuffle } from 'lodash'
import { getAlerts } from './cases'
import { getRandomUser } from './accounts'
import { pickRandom } from './prng'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'

export const getQASamples = memoize(() => {
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
    createdBy: getRandomUser().assigneeUserId,
    createdAt: Date.now(),
    priority: pickRandom(PRIORITYS),
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
    createdBy: getRandomUser().assigneeUserId,
    createdAt: Date.now(),
    priority: pickRandom(PRIORITYS),
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
