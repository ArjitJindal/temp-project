import { RuleService } from '@/services/rules-engine'

async function syncRulesLibrary() {
  await RuleService.syncRulesLibrary()
}

if (require.main === module) {
  void syncRulesLibrary()
}
