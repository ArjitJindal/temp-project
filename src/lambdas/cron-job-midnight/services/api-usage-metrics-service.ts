import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { Dimension } from '@aws-sdk/client-cloudwatch'
import _ from 'lodash'
import { SheetsApiUsageMetricsService } from './sheets-api-usage-metrics-service'
import { logger } from '@/core/logger'
import { METRICS_COLLECTION } from '@/utils/mongoDBUtils'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TenantInfo } from '@/services/tenants'
import {
  publishMetrics,
  Metric,
  TRANSACTIONS_COUNT_METRIC,
  TRANSACTION_EVENTS_COUNT_METRIC,
  USERS_COUNT_METRIC,
  ACTIVE_RULE_INSTANCES_COUNT_METRIC,
  MetricsData,
  SANCTIONS_SEARCHES_COUNT_METRIC,
  TENANT_SEATS_COUNT_METRIC,
  IBAN_RESOLUTION_COUNT_METRIC,
} from '@/core/cloudwatch/metrics'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { AccountsService, Tenant } from '@/services/accounts'
import { SanctionsSearchRepository } from '@/services/sanctions/repositories/sanctions-search-repository'
import { IBANApiRepository } from '@/services/iban.com/repositories/iban-api-repository'

export type ApiUsageMetrics = {
  name: string
  value: string | number | undefined
  startTimestamp: number
  endTimestamp: number
  collectedTimestamp: number
}

export class ApiUsageMetricsService {
  tenantId: string
  tenant: Tenant
  connections: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
  startTimestamp: number
  endTimestamp: number

  constructor(
    tenant: Tenant,
    connections: {
      mongoDb: MongoClient
      dynamoDb: DynamoDBDocumentClient
    },
    timestamp: {
      startTimestamp: number
      endTimestamp: number
    }
  ) {
    this.tenantId = tenant.id
    this.tenant = tenant
    this.connections = connections
    this.startTimestamp = timestamp.startTimestamp
    this.endTimestamp = timestamp.endTimestamp
  }

  public async getTransactionsCount(): Promise<number> {
    const mongoDbTransactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.connections.mongoDb
    )

    const transactionsCount =
      await mongoDbTransactionRepository.getTransactionsCount({
        beforeTimestamp: this.endTimestamp,
        afterTimestamp: this.startTimestamp,
      })

    return transactionsCount
  }

  public async getTransactionsEventsCount(): Promise<number> {
    const transactionEventsRepository = new TransactionEventRepository(
      this.tenantId,
      { mongoDb: this.connections.mongoDb }
    )

    const transactionEventsCount =
      await transactionEventsRepository.getTransactionEventCount({
        timestamp: { $gte: this.startTimestamp, $lt: this.endTimestamp },
      })

    const transactionsCount = await this.getTransactionsCount()
    return transactionEventsCount - transactionsCount
  }

  public async getUsersCount(): Promise<number> {
    const usersRepository = new UserRepository(this.tenantId, {
      mongoDb: this.connections.mongoDb,
    })

    return await usersRepository.getUsersCount({
      createdTimestamp: {
        $gte: this.startTimestamp,
        $lt: this.endTimestamp,
      },
    })
  }

  private async getAllActiveRuleInstancesCount(): Promise<number> {
    const ruleInstanceRepository = new RuleInstanceRepository(this.tenantId, {
      dynamoDb: this.connections.dynamoDb,
    })

    const allInstances = await ruleInstanceRepository.getActiveRuleInstances(
      'TRANSACTION'
    )

    return allInstances.length
  }

  private getDimensions(tenantInfo: TenantInfo): Dimension[] {
    logger.info(
      `Tenant Id: ${tenantInfo.tenant.id}, Tenant Name: ${tenantInfo.tenant.name}, Region: ${process.env.AWS_REGION}`
    )
    return [
      {
        Name: 'Tenant Id',
        Value: tenantInfo.tenant.id,
      },
      {
        Name: 'Tenant Name',
        Value: tenantInfo.tenant.name,
      },
      {
        Name: 'Region',
        Value: process.env.AWS_REGION as string,
      },
    ]
  }

  private async getNumberOfSeats(tenantInfo: TenantInfo): Promise<number> {
    const accountsService = new AccountsService(
      { auth0Domain: tenantInfo.auth0Domain },
      { mongoDb: this.connections.mongoDb }
    )

    const account = await accountsService.getTenantAccounts(tenantInfo.tenant)

    const filteredAccount = account.filter(
      (account) => account.role !== 'root' && !account.blocked
    )

    return filteredAccount.length
  }

  public async getNumberOfSanctionsChecks(): Promise<number> {
    const sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      this.connections.mongoDb
    )

    return await sanctionsSearchRepository.getNumberOfSearchesBetweenTimestamps(
      this.startTimestamp,
      this.endTimestamp
    )
  }

  public async getNumberOfIbanResolutions(): Promise<number> {
    const ibanApiRepository = new IBANApiRepository(
      this.tenantId,
      this.connections.mongoDb
    )

    return ibanApiRepository.getNumberOfResolutionsBetweenTimestamps(
      this.startTimestamp,
      this.endTimestamp
    )
  }

  private async getValuesOfMetrics(
    tenantInfo: TenantInfo
  ): Promise<Array<[Metric, number]>> {
    const transactionsCount = await this.getTransactionsCount()
    const transactionEventsCount = await this.getTransactionsEventsCount()
    const usersCount = await this.getUsersCount()
    const activeRuleInstancesCount = await this.getAllActiveRuleInstancesCount()
    const sanctionsChecksCount = await this.getNumberOfSanctionsChecks()
    const ibanResolutinosCount = await this.getNumberOfIbanResolutions()
    const numberOfSeats = await this.getNumberOfSeats(tenantInfo)

    logger.info(
      `Transactions count: ${transactionsCount}, Transaction events count: ${transactionEventsCount}, Users count: ${usersCount}, Active rule instances count: ${activeRuleInstancesCount}`
    )

    return [
      [TRANSACTIONS_COUNT_METRIC, transactionsCount],
      [TRANSACTION_EVENTS_COUNT_METRIC, transactionEventsCount],
      [USERS_COUNT_METRIC, usersCount],
      [ACTIVE_RULE_INSTANCES_COUNT_METRIC, activeRuleInstancesCount],
      [SANCTIONS_SEARCHES_COUNT_METRIC, sanctionsChecksCount],
      [IBAN_RESOLUTION_COUNT_METRIC, ibanResolutinosCount],
      [TENANT_SEATS_COUNT_METRIC, numberOfSeats],
    ]
  }

  private async publishToGoogleSheets() {
    const sheetsService = new SheetsApiUsageMetricsService(this.tenant, {
      mongoDb: this.connections.mongoDb,
    })

    await sheetsService.initialize()

    await sheetsService.updateUsageMetrics(
      this.startTimestamp,
      this.endTimestamp
    )
  }

  public async publishApiUsageMetrics(tenantInfo: TenantInfo): Promise<void> {
    const dimensions = this.getDimensions(tenantInfo)
    const values = await this.getValuesOfMetrics(tenantInfo)

    const metricsData: Array<MetricsData> = values.map(([metric, value]) => {
      return {
        metric,
        dimensions,
        value,
      }
    })

    logger.info(`Metrics data: ${JSON.stringify(metricsData)}`)

    await publishMetrics(metricsData)
    await this.pushMetricsToMongoDb(
      _.fromPairs(values.map(([metric, value]) => [metric.name, value]))
    )
    await this.publishToGoogleSheets()
  }

  private async pushMetricsToMongoDb(
    data: Record<string, number | string | undefined>
  ): Promise<void> {
    const mongoDb = this.connections.mongoDb.db()
    const metricsCollectionName = METRICS_COLLECTION(this.tenantId)
    const metricsCollection = mongoDb.collection(metricsCollectionName)

    logger.info(
      `Pushing metrics to MongoDB collection: ${metricsCollectionName}`
    )

    const metric: ApiUsageMetrics[] = Object.keys(data).map((key) => {
      return {
        name: key,
        value: data[key],
        startTimestamp: this.startTimestamp,
        endTimestamp: this.endTimestamp,
        collectedTimestamp: Date.now(),
      }
    })

    logger.info(`Metrics MongoDB document: ${JSON.stringify(metric)}`)

    await Promise.all(
      metric.map(
        async (metric) =>
          await metricsCollection.updateOne(
            {
              name: metric.name,
              startTimestamp: metric.startTimestamp,
              endTimestamp: metric.endTimestamp,
            },
            { $set: metric },
            { upsert: true }
          )
      )
    )
  }
}
