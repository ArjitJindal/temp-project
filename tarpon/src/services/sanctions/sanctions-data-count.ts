import {
  withScope as withScopeSentry,
  captureMessage as captureMessageSentry,
} from '@sentry/aws-serverless'
import { MongoClient } from 'mongodb'
import { getSanctionsCollectionName } from './utils'
import { SanctionsDataProviders } from './types'
import { envIs } from '@/utils/env'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'

// Thresholds for sanctions data counts
const SANCTIONS_DATA_THRESHOLDS = {
  ACURIS_PERSON: 3000000, // 3M threshold (slightly below expected 3.4M)
  ACURIS_BUSINESS: 900000, // 900K threshold (slightly below expected 993K)
  OPEN_SANCTIONS_PERSON: 750000, // 750K threshold (slightly below expected 820K)
  OPEN_SANCTIONS_BUSINESS: 80000, // 80K threshold (slightly below expected 93K)
} as const

// Optimization: Using estimatedDocumentCount() instead of countDocuments() for performance
// estimatedDocumentCount() uses collection metadata and is much faster for large collections
// If exact counts are required, consider using aggregation pipeline with proper indexes:
// .aggregate([{ $count: "total" }]).next().then(result => result?.total || 0)

export async function runSanctionsDataCountJob(
  provider: SanctionsDataProviderName,
  client: MongoClient
) {
  const personCollectionName = getSanctionsCollectionName(
    { provider, entityType: 'PERSON' },
    '',
    'full'
  )
  const businessCollectionName = getSanctionsCollectionName(
    { provider, entityType: 'BUSINESS' },
    '',
    'full'
  )
  let personCount = 0
  let businessCount = 0
  if (provider === SanctionsDataProviders.ACURIS) {
    ;[personCount, businessCount] = await Promise.all([
      client.db().collection(personCollectionName).estimatedDocumentCount(), // Much faster than countDocuments()
      client.db().collection(businessCollectionName).estimatedDocumentCount(), // Much faster than countDocuments()
    ])
  }

  if (provider === SanctionsDataProviders.OPEN_SANCTIONS) {
    ;[personCount, businessCount] = await Promise.all([
      client.db().collection(personCollectionName).estimatedDocumentCount(), // Much faster than countDocuments()
      client.db().collection(businessCollectionName).estimatedDocumentCount(), // Much faster than countDocuments()
    ])
  }

  await logMissingSanctionsData(personCount, businessCount, provider)
}

async function logMissingSanctionsData(
  personCount: number,
  businessCount: number,
  provider: SanctionsDataProviderName
) {
  if (envIs('prod')) {
    let message = ''
    const missingData: string[] = []

    // Check Acuris data counts
    if (provider === SanctionsDataProviders.ACURIS) {
      if (personCount < SANCTIONS_DATA_THRESHOLDS.ACURIS_PERSON) {
        missingData.push(
          `Acuris person count (${personCount.toLocaleString()}) below threshold (${SANCTIONS_DATA_THRESHOLDS.ACURIS_PERSON.toLocaleString()})`
        )
      }
      if (businessCount < SANCTIONS_DATA_THRESHOLDS.ACURIS_BUSINESS) {
        missingData.push(
          `Acuris business count (${businessCount.toLocaleString()}) below threshold (${SANCTIONS_DATA_THRESHOLDS.ACURIS_BUSINESS.toLocaleString()})`
        )
      }
    }

    // Check OpenSanctions data counts
    if (provider === SanctionsDataProviders.OPEN_SANCTIONS) {
      if (personCount < SANCTIONS_DATA_THRESHOLDS.OPEN_SANCTIONS_PERSON) {
        missingData.push(
          `OpenSanctions person count (${personCount.toLocaleString()}) below threshold (${SANCTIONS_DATA_THRESHOLDS.OPEN_SANCTIONS_PERSON.toLocaleString()})`
        )
      }
      if (businessCount < SANCTIONS_DATA_THRESHOLDS.OPEN_SANCTIONS_BUSINESS) {
        missingData.push(
          `OpenSanctions business count (${businessCount.toLocaleString()}) below threshold (${SANCTIONS_DATA_THRESHOLDS.OPEN_SANCTIONS_BUSINESS.toLocaleString()})`
        )
      }
    }

    if (missingData.length > 0) {
      message = `Missing sanctions data for provider ${provider}: ${missingData.join(
        ', '
      )}`
      withScopeSentry((scope) => {
        scope.setFingerprint([provider, 'sanctions-data-count'])
        scope.setTag('provider', provider)
        scope.setExtra('personCount', personCount)
        scope.setExtra('businessCount', businessCount)
        scope.setExtra('missingData', missingData)
        captureMessageSentry(message, {
          level: 'warning',
        })
      })
    }
  }
}
