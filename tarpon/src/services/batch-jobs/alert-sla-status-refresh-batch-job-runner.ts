import { AlertsSLAService } from '../alerts/alerts-sla-service'
import { BatchJobRunner } from './batch-job-runner-base'
import { AlertSLAStatusRefreshBatchJob } from '@/@types/batch-job'
import { getContext } from '@/core/utils/context'
import { traceable } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'

@traceable
export class AlertSLAStatusRefreshBatchJobRunner extends BatchJobRunner {
  protected async run(job: AlertSLAStatusRefreshBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const context = getContext()
    const slaStatusCalculationService = new AlertsSLAService(
      tenantId,
      mongoDb,
      context?.auth0Domain as string
    )
    await slaStatusCalculationService.calculateAndUpdateSLAStatuses()
  }
}
