import { BatchJobRunner } from './batch-job-runner-base'
import { envIsNot } from '@/utils/env'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { traceable } from '@/core/xray'
import { isDemoTenant } from '@/utils/tenant'
import { logger } from '@/core/logger'
import { seedDemoData } from '@/core/seed'

@traceable
export class DemoModeDataLoadJobRunner extends BatchJobRunner {
  protected async run(job: DemoModeDataLoadBatchJob): Promise<void> {
    const { tenantId } = job
    if (envIsNot('dev') && !isDemoTenant(tenantId)) {
      logger.warn(`Tenant ${tenantId} is not a demo tenant`)
      return
    }
    await seedDemoData(tenantId)
  }
}
