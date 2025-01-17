import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { BadRequest, NotFound } from 'http-errors'
import { CurrencyService } from '../currency'
import { CaseService } from '@/services/cases'
import { UserService } from '@/services/users'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { ReportService } from '@/services/sar/service'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import {
  AttributeGenerator,
  AttributeSet,
  DefaultAttributeBuilders,
} from '@/services/copilot/attributes/builder'
import { NarrativeType } from '@/@types/openapi-internal/NarrativeType'
import { tenantSettings } from '@/core/utils/context'
import { AI_SOURCES } from '@/services/copilot/attributes/ai-sources'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'

export class RetrievalService {
  private readonly caseService: CaseService
  private readonly userService: UserService
  private readonly txnRepository: MongoDbTransactionRepository
  private readonly reportService: ReportService
  private readonly ruleInstanceRepository: RuleInstanceRepository
  private readonly attributeBuilder: AttributeGenerator

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

    const [caseService, userService, txnRepository, reportService] =
      await Promise.all([
        CaseService.fromEvent(event),
        UserService.fromEvent(event),
        MongoDbTransactionRepository.fromEvent(event),
        ReportService.fromEvent(event),
      ])
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb: getDynamoDbClientByEvent(event),
    })
    return new this(
      caseService,
      userService,
      txnRepository,
      reportService,
      ruleInstanceRepository,
      enabledAttributes
    )
  }

  constructor(
    caseService: CaseService,
    userService: UserService,
    txnRepository: MongoDbTransactionRepository,
    reportService: ReportService,
    ruleInstanceRepository: RuleInstanceRepository,
    enabledAttributes: AIAttribute[]
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
  }

  async getAttributes(
    entityId: string,
    entityType: NarrativeType,
    reasons: Array<string>
  ) {
    switch (entityType) {
      case 'REPORT':
        return this.getReportAttributes(entityId, reasons)
      case 'CASE':
        return this.getCaseAttributes(entityId, reasons)
      case 'ALERT':
        return this.getAlertAttributes(entityId, reasons)
      case 'TRANSACTION': {
        throw new Error('Not implemented yet: "TRANSACTION" case')
      }
      case 'SANCTIONS_HIT': {
        throw new Error('Not implemented yet: "SANCTIONS_HIT" case')
      }
    }
    throw new NotFound(`Entity type not supported: ${entityType}`)
  }

  private async getReportAttributes(
    reportId: string,
    reasons: Array<string>
  ): Promise<AttributeSet> {
    const report = await this.reportService.getReport(reportId)
    const caseItem = report.caseId
      ? await this.caseService.getCase(report.caseId)
      : undefined

    const user = await this.userService.getUser(report.caseUserId)

    // Hydrate case transactions
    const transactions = await this.txnRepository.getTransactionsByIds(
      report.parameters.transactions?.map((t) => t.id) ||
        caseItem?.caseTransactionsIds ||
        []
    )

    const exchangeRates = await new CurrencyService().getExchangeData()

    return await this.attributeBuilder.getAttributes({
      transactions,
      user,
      reasons,
      _case: caseItem,
      exchangeRates: exchangeRates.rates,
    })
  }

  private async getCaseAttributes(
    caseId: string,
    reasons: Array<string>
  ): Promise<AttributeSet> {
    const _case = await this.caseService.getCase(caseId)

    const ruleInstanceIds =
      _case?.alerts?.map((a) => a.ruleInstanceId as string) || []

    const user = await this.userService.getUser(
      _case?.caseUsers?.origin?.userId ||
        _case?.caseUsers?.destination?.userId ||
        ''
    )

    const [transactions, ruleInstances] = await Promise.all([
      this.txnRepository.getTransactionsByIds(_case.caseTransactionsIds || []),
      this.ruleInstanceRepository.getRuleInstancesByIds(
        ruleInstanceIds.filter((id) => id)
      ),
    ])

    const exchangeRates = await new CurrencyService().getExchangeData()

    return await this.attributeBuilder.getAttributes({
      transactions,
      user,
      _case,
      ruleInstances,
      reasons,
      exchangeRates: exchangeRates.rates,
    })
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

    const user = await this.userService.getUser(
      _case?.caseUsers?.origin?.userId ||
        _case?.caseUsers?.destination?.userId ||
        ''
    )

    const [transactions, ruleInstances] = await Promise.all([
      this.txnRepository.getTransactionsByIds(alert?.transactionIds || []),
      this.ruleInstanceRepository.getRuleInstancesByIds(
        alert?.ruleInstanceId ? [alert.ruleInstanceId] : []
      ),
    ])

    const exchangeRates = await new CurrencyService().getExchangeRates()

    return await this.attributeBuilder.getAttributes({
      transactions,
      user,
      ruleInstances,
      reasons,
      _alert: alert,
      exchangeRates,
    })
  }
}
