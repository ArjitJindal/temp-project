import { exit } from 'process'
import { cleanUpStaleQaEnvs } from '@lib/qa-cleanup'
import { logger } from '@/core/logger'

process.env.ENV = 'dev'
process.env.AWS_REGION = 'eu-central-1'

if (require.main === module) {
  cleanUpStaleQaEnvs()
    .then(() => console.info('Cleanup finished!'))
    .catch((e) => {
      logger.error(e)
      exit(1)
    })
}
