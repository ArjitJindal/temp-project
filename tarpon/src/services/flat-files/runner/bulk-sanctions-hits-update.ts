import { memoize } from 'lodash'
import { FlatFileRunner } from '.'
import { SanctionsHitUpdate } from '@/@types/openapi-internal/SanctionsHitUpdate'
import { FlatFileValidationResult } from '@/@types/flat-files'
import { getS3Client } from '@/utils/s3'
import { AlertsService } from '@/services/alerts'
import { AlertsRepository } from '@/services/alerts/repository'
import { SanctionsHitService } from '@/services/sanctionsHit'
import { traceable } from '@/core/xray'

@traceable
export class BulkSanctionsHitsUpdateRunner extends FlatFileRunner<SanctionsHitUpdate> {
  model = SanctionsHitUpdate
  public concurrency = 10

  private getAlertsRepository = memoize(() => {
    return new AlertsRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
  })

  private getSanctionsHitService = memoize(() => {
    return new SanctionsHitService(
      this.tenantId,
      { dynamoDb: this.dynamoDb, mongoDb: this.mongoDb },
      getS3Client(),
      {
        documentBucketName: process.env.DOCUMENT_BUCKET as string,
        tmpBucketName: process.env.TMP_BUCKET as string,
      }
    )
  })

  private getAlertService = memoize(() => {
    const s3 = getS3Client()
    const alertsRepository = this.getAlertsRepository()
    const alertService = new AlertsService(alertsRepository, s3, {
      documentBucketName: process.env.DOCUMENT_BUCKET as string,
      tmpBucketName: process.env.TMP_BUCKET as string,
    })
    return alertService
  })

  async validate(
    data: SanctionsHitUpdate
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>> {
    const alertService = this.getAlertService()
    const alert = await alertService.getAlert(data.alertId)
    if (!alert) {
      return {
        valid: false,
        errors: [
          {
            message: `Alert ${data.alertId} not found`,
            keyword: 'ALERT_NOT_FOUND',
            stage: 'VALIDATE',
          },
        ],
      }
    }

    if (data.reason === 'OTHER' && !data.otherReason) {
      return {
        valid: false,
        errors: [
          {
            message: `Other reason is required when reason is OTHER`,
            keyword: 'OTHER_REASON_REQUIRED',
            stage: 'VALIDATE',
          },
        ],
      }
    }

    const sanctionsHitService = this.getSanctionsHitService()

    const sanctionsHit = await sanctionsHitService.getSanctionsHit(
      data.sanctionsHitId
    )

    if (!sanctionsHit) {
      return {
        valid: false,
        errors: [
          {
            message: `Sanctions hit ${data.sanctionsHitId} not found`,
            keyword: 'SANCTIONS_HIT_NOT_FOUND',
            stage: 'VALIDATE',
          },
        ],
      }
    }

    return {
      valid: true,
      errors: [],
    }
  }

  async _run(data: SanctionsHitUpdate): Promise<void> {
    const sanctionsHitService = this.getSanctionsHitService()
    await sanctionsHitService.changeSanctionsHitsStatus(
      data.alertId,
      [data.sanctionsHitId],
      {
        status: data.sanctionsHitStatus,
        reasons: [data.reason],
        otherReason: data.otherReason,
        whitelistHits: data.whitelistHits,
        removeHitsFromWhitelist: data.removeHitsFromWhitelist,
        comment: data.comment,
      }
    )
  }
}
