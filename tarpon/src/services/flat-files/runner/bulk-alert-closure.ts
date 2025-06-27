import { memoize } from 'lodash'
import { FlatFileRunner } from '.'
import { FlatFileValidationResult } from '@/@types/flat-files'
import { AlertClosure } from '@/@types/openapi-internal/AlertClosure'
import { AlertsRepository } from '@/services/alerts/repository'
import { AlertsService } from '@/services/alerts'
import { getS3Client } from '@/utils/s3'
import { ReasonsService } from '@/services/tenants/reasons-service'
import { memoizePromise } from '@/utils/memoize'
import { traceable } from '@/core/xray'

@traceable
export class BulkAlertClosureRunner extends FlatFileRunner<AlertClosure> {
  model = AlertClosure
  public concurrency = 10

  private getAlertsRepository = memoize(() => {
    return new AlertsRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
  })

  private getAlertService = memoizePromise(async () => {
    const alertsRepository = this.getAlertsRepository()
    const s3 = getS3Client()
    const alertsService = new AlertsService(alertsRepository, s3, {
      documentBucketName: process.env.DOCUMENT_BUCKET as string,
      tmpBucketName: process.env.TMP_BUCKET as string,
    })
    return alertsService
  })

  private getReasons = memoizePromise(async () => {
    const reasonsService = new ReasonsService(this.tenantId, this.mongoDb)
    const reasons = await reasonsService.getReasons()
    return reasons
  })

  async validate(
    data: AlertClosure
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>> {
    const alertService = await this.getAlertService()

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

    const reasons = await this.getReasons()
    const reason = reasons.find((r) => r.reason === data.reason)

    if (!reason) {
      return {
        valid: false,
        errors: [
          {
            message: `Reason ${data.reason} not found`,
            keyword: 'REASON_NOT_FOUND',
            stage: 'VALIDATE',
          },
        ],
      }
    }

    if (reason.reason === 'OTHER' && !data.otherReason) {
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

    return {
      valid: true,
      errors: [],
    }
  }

  async _run(data: AlertClosure): Promise<void> {
    const alertService = await this.getAlertService()
    await alertService.updateStatus([data.alertId], {
      alertStatus: 'CLOSED',
      otherReason: data.otherReason,
      reason: [data.reason],
      comment: data.comment,
      closeSourceCase: true,
    })
  }
}
