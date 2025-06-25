import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { BadRequest } from 'http-errors'
import { compact, uniq } from 'lodash'
import { CurrencyService } from '../currency'
import { AlertsService } from '../alerts'
import { SanctionsHitsRepository } from '../sanctions/repositories/sanctions-hits-repository'
import { AttributeSet } from './attributes/attribute-set'
import { CaseService } from '@/services/cases'
import { UserService } from '@/services/users'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { ReportService } from '@/services/sar/service'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import {
  AttributeGenerator,
  DefaultAttributeBuilders,
} from '@/services/copilot/attributes/builder'
import { NarrativeType } from '@/@types/openapi-internal/NarrativeType'
import { tenantSettings } from '@/core/utils/context'
import { AI_SOURCES } from '@/services/copilot/attributes/ai-sources'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { Alert } from '@/@types/openapi-internal/Alert'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { AdditionalCopilotInfo } from '@/@types/openapi-internal/AdditionalCopilotInfo'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

export class RetrievalService {
  private readonly caseService: CaseService
  private readonly alertService: AlertsService
  private readonly userService: UserService
  private readonly txnRepository: MongoDbTransactionRepository
  private readonly reportService: ReportService
  private readonly ruleInstanceRepository: RuleInstanceRepository
  private readonly attributeBuilder: AttributeGenerator
  private readonly sanctionsHitsRepository: SanctionsHitsRepository
  private readonly currencyService: CurrencyService
  public static async new(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const tenantId = event.requestContext.authorizer.principalId
    if (!tenantId) {
      throw new Error('No tenant ID')
    }
    const settings = await tenantSettings(tenantId)
    const enabledAttributes = AI_SOURCES.filter(
      (s) =>
        !s.isPii &&
        (settings.aiSourcesDisabled == undefined ||
          settings.aiSourcesDisabled.indexOf(s.sourceName) < 0)
    ).map((a) => a.sourceName)

    const [
      caseService,
      userService,
      txnRepository,
      reportService,
      alertService,
      sanctionsHitsRepository,
    ] = await Promise.all([
      CaseService.fromEvent(event),
      UserService.fromEvent(event),
      MongoDbTransactionRepository.fromEvent(event),
      ReportService.fromEvent(event),
      AlertsService.fromEvent(event),
      SanctionsHitsRepository.fromEvent(event),
    ])
    const dynamoDb = getDynamoDbClientByEvent(event)
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const currencyService = new CurrencyService(dynamoDb)
    return new this(
      caseService,
      userService,
      txnRepository,
      reportService,
      ruleInstanceRepository,
      enabledAttributes,
      alertService,
      sanctionsHitsRepository,
      currencyService
    )
  }

  constructor(
    caseService: CaseService,
    userService: UserService,
    txnRepository: MongoDbTransactionRepository,
    reportService: ReportService,
    ruleInstanceRepository: RuleInstanceRepository,
    enabledAttributes: AIAttribute[],
    alertService: AlertsService,
    sanctionsHitsRepository: SanctionsHitsRepository,
    currencyService: CurrencyService
  ) {
    this.caseService = caseService
    this.userService = userService
    this.txnRepository = txnRepository
    this.reportService = reportService
    this.ruleInstanceRepository = ruleInstanceRepository
    this.attributeBuilder = new AttributeGenerator(
      DefaultAttributeBuilders,
      enabledAttributes
    )
    this.alertService = alertService
    this.sanctionsHitsRepository = sanctionsHitsRepository
    this.currencyService = currencyService
  }

  async getAttributes(
    entityId: string,
    entityType: NarrativeType,
    reasons: Array<string>,
    additionalCopilotInfo?: AdditionalCopilotInfo
  ) {
    switch (entityType) {
      case 'REPORT':
        return this.getReportAttributes(entityId, additionalCopilotInfo)
      case 'CASE':
        return this.getCaseAttributes(entityId, reasons)
      case 'ALERT':
        return this.getAlertAttributes(entityId, reasons)
      case 'TRANSACTION': {
        return this.getTransactionAttributes(entityId, reasons)
      }
      case 'SANCTIONS_HIT': {
        throw new Error('Not implemented yet: "SANCTIONS_HIT" case')
      }
    }
  }

  private async getReportAttributes(
    reportId: string,
    additionalCopilotInfo?: AdditionalCopilotInfo
  ): Promise<AttributeSet> {
    const report = await this.reportService.getReport(reportId)
    const caseItem = report.caseId
      ? (await this.caseService.getCase(report.caseId)).result
      : undefined

    const user = await this.userService.getUser(report.caseUserId, false)

    // Hydrate case transactions
    const transactionId =
      additionalCopilotInfo?.additionalSarInformation?.transactionId
    const currentTransaction = transactionId
      ? (await this.txnRepository.getTransactionById(transactionId)) ??
        undefined
      : undefined

    const exchangeRates = await this.currencyService.getExchangeData()

    return await this.attributeBuilder.getAttributes({
      currentTransaction,
      user,
      reasons: compact(
        uniq(currentTransaction?.hitRules.map((r) => r.ruleName))
      ),
      _case: caseItem,
      exchangeRates: exchangeRates.rates,
    })
  }

  private async getTransactionAttributes(
    transactionId: string,
    reasons: Array<string>
  ): Promise<AttributeSet> {
    const transaction = await this.txnRepository.getTransactionById(
      transactionId
    )
    if (!transaction) {
      throw new BadRequest(`No transaction for ${transactionId}`)
    }
    let originUser: InternalUser | undefined
    let destinationUser: InternalUser | undefined
    if (transaction.originUserId) {
      originUser = await this.userService.getUser(
        transaction.originUserId,
        true
      )
    }
    if (transaction.destinationUserId) {
      destinationUser = await this.userService.getUser(
        transaction.destinationUserId,
        true
      )
    }
    const exchangeRates = await this.currencyService.getExchangeData()
    const _alerts = await this.alertService.getAlertsByIds(
      transaction?.alertIds ?? []
    )
    const ruleInstances =
      await this.ruleInstanceRepository.getRuleInstancesByIds(
        uniq(_alerts.map((a) => a.ruleInstanceId))
      )
    return this.attributeBuilder.getAttributes({
      currentTransaction: transaction,
      reasons,
      user: (originUser ?? destinationUser) as
        | InternalConsumerUser
        | InternalBusinessUser,
      exchangeRates: exchangeRates.rates,
      originUser,
      destinationUser,
      _alerts,
      ruleInstances,
    })
  }

  private async getCaseAttributes(
    caseId: string,
    reasons: Array<string>
  ): Promise<AttributeSet> {
    const response = await this.caseService.getCase(caseId)
    const _case = response.result

    const ruleInstanceIds =
      _case?.alerts?.map((a) => a.ruleInstanceId as string) || []

    const user = await this.userService.getUser(
      _case?.caseUsers?.origin?.userId ||
        _case?.caseUsers?.destination?.userId ||
        '',
      true
    )

    const [transactions, ruleInstances] = await Promise.all([
      this.txnRepository.getTransactionsByIds(_case.caseTransactionsIds || []),
      this.ruleInstanceRepository.getRuleInstancesByIds(
        ruleInstanceIds.filter((id) => id)
      ),
    ])

    const sanctionsHits = await this.getSanctionsHitAttributes(
      _case.alerts || []
    )

    const exchangeRates = await this.currencyService.getExchangeData()

    return await this.attributeBuilder.getAttributes({
      transactions,
      user,
      _case,
      ruleInstances,
      reasons,
      exchangeRates: exchangeRates.rates,
      _alerts: _case.alerts || [],
      sanctionsHits,
    })
  }

  private async getSanctionsHitAttributes(
    alerts: Alert[]
  ): Promise<SanctionsHit[]> {
    const sanctionsHitIds = compact(
      alerts.flatMap(
        (a) =>
          a.ruleHitMeta?.sanctionsDetails?.map((sd) => sd.sanctionHitIds) || []
      )
    ).flat()
    const sanctionsHits = await this.sanctionsHitsRepository.getHitsByIds(
      sanctionsHitIds
    )

    return sanctionsHits
  }

  private async getAlertAttributes(
    alertId: string,
    reasons: Array<string>
  ): Promise<AttributeSet> {
    const _case = await this.caseService.getCaseByAlertId(alertId)

    if (!_case) {
      throw new BadRequest(`No alert for ${alertId}`)
    }

    const alert = _case?.alerts?.find((a) => a.alertId === alertId)

    if (!alert) {
      throw new BadRequest(`No alert for ${alertId}`)
    }

    const user = await this.userService.getUser(
      _case?.caseUsers?.origin?.userId ||
        _case?.caseUsers?.destination?.userId ||
        '',
      true
    )

    const [transactions, ruleInstances] = await Promise.all([
      this.txnRepository.getTransactionsByIds(alert?.transactionIds || []),
      this.ruleInstanceRepository.getRuleInstancesByIds(
        alert?.ruleInstanceId ? [alert.ruleInstanceId] : []
      ),
    ])

    const exchangeRates = await this.currencyService.getExchangeRates()

    const isAnyScreeningRule = ruleInstances.some(
      (ri) => ri.nature === 'SCREENING'
    )

    let allScreeningHits: SanctionsHit[] = []

    if (isAnyScreeningRule) {
      const sanctionsHits = await this.getSanctionsHitAttributes([alert])
      allScreeningHits = sanctionsHits
    }

    return await this.attributeBuilder.getAttributes({
      transactions,
      user,
      ruleInstances,
      reasons,
      _alerts: [alert],
      exchangeRates,
      sanctionsHits: allScreeningHits,
    })
  }
}
