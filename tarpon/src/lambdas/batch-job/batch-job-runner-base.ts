import { BatchJob } from '@/@types/batch-job'
import { waitForTasks, initBackground } from '@/utils/background'

export abstract class BatchJobRunner {
  protected abstract run(job: BatchJob): Promise<any>
  public async execute(job: BatchJob): Promise<any> {
    initBackground()
    const result = this.run(job)
    await waitForTasks()
    return result
  }
}
