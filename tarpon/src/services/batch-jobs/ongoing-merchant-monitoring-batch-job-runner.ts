import { BatchJobRunner } from './batch-job-runner-base'
import { OngoingMerchantMonitoringBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { MerchantMonitoringScrapeService } from '@/services/merchant-monitoring/merchant-monitoring-scrape'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { MerchantMonitoringIndustryUserRuleParameters } from '@/services/rules-engine/user-rules/merchant-monitoring-industry'
import { ONGOING_MERCHANT_MONITORING_RULE_IDS } from '@/services/rules-engine/transaction-rules/library'
import { logger } from '@/core/logger'
import { ensureHttps } from '@/utils/http'
import { traceable } from '@/core/xray'

@traceable
export class OngoingMerchantMonitoringBatchJobRunner extends BatchJobRunner {
  protected async run(job: OngoingMerchantMonitoringBatchJob): Promise<void> {
    const { tenantId } = job
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const allActiveRules = await ruleInstanceRepository.getActiveRuleInstances(
      'USER'
    )
    const merchantMonitoringRuleIds = allActiveRules.filter((rule) =>
      ONGOING_MERCHANT_MONITORING_RULE_IDS.includes(rule.ruleId ?? '')
    )

    if (!merchantMonitoringRuleIds.length) {
      return
    }

    const merchantMonitoringParameters = [
      ...new Set(
        merchantMonitoringRuleIds.flatMap(
          (rule) =>
            (rule.parameters as MerchantMonitoringIndustryUserRuleParameters)
              .sourceType
        )
      ),
    ]

    logger.info(
      `Running merchant monitoring for tenant ${tenantId} with parameters ${merchantMonitoringParameters}`
    )

    if (!merchantMonitoringParameters.length) {
      logger.info(
        `No merchant monitoring parameters found for tenant ${tenantId}`
      )
      return
    }

    const merchantMonitoringService =
      await MerchantMonitoringScrapeService.init()

    for await (const user of userRepository.getOngoingScreeningUsersCursor()) {
      const allWebsites = merchantMonitoringParameters?.includes('SCRAPE')
        ? [
            ...new Set(
              (user?.legalEntity?.contactDetails?.websites ?? []).map(
                (website) => ensureHttps(website)
              )
            ),
          ]
        : []

      logger.info(
        `Running merchant monitoring for user ${user.userId} with websites ${allWebsites}`
      )

      logger.info(
        `Legal name: ${user.legalEntity.companyGeneralDetails.legalName}`
      )

      await merchantMonitoringService.getMerchantMonitoringSummaries(
        tenantId,
        user.userId,
        user.legalEntity.companyGeneralDetails.legalName ?? '',
        allWebsites[0],
        {
          refresh: true,
          additionalDomains:
            allWebsites.length > 1 ? allWebsites.slice(1) : undefined,
          skipExisting: true,
          onlyTypes: merchantMonitoringParameters,
        }
      )
    }
  }
}
