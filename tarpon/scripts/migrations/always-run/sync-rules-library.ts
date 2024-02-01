import { logger } from '@/core/logger'
import { RuleService } from '@/services/rules-engine'

async function syncRulesLibrary() {
  await RuleService.syncRulesLibrary()
}

if (require.main === module) {
  void syncRulesLibrary()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}
