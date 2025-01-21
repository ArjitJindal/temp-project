import { SLAService } from '../sla/sla-service'
import { BatchJobRunner } from './batch-job-runner-base'
import {
  AlertSLAStatusRefreshBatchJob,
  CaseSLAStatusRefreshBatchJob,
} from '@/@types/batch-job'
import { getContext } from '@/core/utils/context'
import { traceable } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'

@traceable
export class AlertSLAStatusRefreshBatchJobRunner extends BatchJobRunner {
  protected async run(job: AlertSLAStatusRefreshBatchJob): Promise<void> {
    const { tenantId, from, to } = job
    const mongoDb = await getMongoDbClient()
    const context = getContext()
    const slaStatusCalculationService = new SLAService(
      tenantId,
      mongoDb,
      context?.auth0Domain as string
    )
    await slaStatusCalculationService.calculateAndUpdateSLAStatusesForAlerts(
      from,
      to
    )
  }
}

@traceable
export class CaseSLAStatusRefreshBatchJobRunner extends BatchJobRunner {
  protected async run(job: CaseSLAStatusRefreshBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const context = getContext()
    const slaStatusCalculationService = new SLAService(
      tenantId,
      mongoDb,
      context?.auth0Domain as string
    )
    await slaStatusCalculationService.calculateAndUpdateSLAStatusesForCases()
  }
}
