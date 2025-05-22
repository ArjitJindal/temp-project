import { exit } from 'process'
import { cleanUpStaleLogGroups } from '@lib/log-group-cleanup'
import { logger } from '@/core/logger'

process.env.ENV = 'dev'
process.env.AWS_REGION = 'eu-central-1'

if (require.main === module) {
  cleanUpStaleLogGroups()
    .then(() => console.info('Cleanup finished!'))
    .catch((e) => {
      logger.error(e)
      exit(1)
    })
}
