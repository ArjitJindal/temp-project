import { humanizeAuto } from '@flagright/lib/utils/humanize'
import compact from 'lodash/compact'
import uniq from 'lodash/uniq'
import {
  DEFAULT_RISK_LEVEL,
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import pMap from 'p-map'
import { memoize, uniqBy } from 'lodash'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { marked } from 'marked'
import htmlToDocx from 'html-to-docx'
import { v4 as uuidv4 } from 'uuid'
import { ReportRepository } from '../sar/repositories/report-repository'
import { PDFExtractionService } from '../pdf-extraction'
import { EddRepository } from '../edd/repository'
import { buildTransactionAggregationsQuery } from '../copilot/questions/definitions/queries/transaction-aggregations-query'
import { buildTransactionTypeQuery } from '../copilot/questions/definitions/queries/transaction-type-query'
import { buildPaymentIdentifierQuery } from '../copilot/questions/definitions/queries/payment-identifier-query'
import { DynamoAccountsRepository } from '@/services/accounts/repository/dynamo'
import { EddReviewBatchJob } from '@/@types/batch-job'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Person } from '@/@types/openapi-public/Person'
import { BatchJobRunner } from '@/services/batch-jobs/batch-job-runner-base'
import { CaseRepository } from '@/services/cases/repository'
import { ClickhouseTransactionsRepository } from '@/services/rules-engine/repositories/clickhouse-repository'
import {
  getClickhouseClient,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3Client } from '@/utils/s3'
import { getSecretByName } from '@/utils/secrets-manager'
import { getAddress, getPersonName, getUserName } from '@/utils/helpers'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { logger } from '@/core/logger'
import { ModelTier } from '@/utils/llms/base-service'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { SanctionsService } from '@/services/sanctions'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { ask } from '@/utils/llms'
import dayjs from '@/utils/dayjs'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { Case } from '@/@types/openapi-internal/Case'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { Account } from '@/@types/openapi-internal/Account'
import { TransactionAmountAggregates } from '@/@types/tranasction/transaction-list'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { Report } from '@/@types/openapi-internal/Report'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

type TransactionAmountData = TransactionAmountAggregates

const DATE_FORMAT = 'MM/DD/YYYY'

type MonthlyAverage = {
  method: string
  inLast12Months: number
  average: number
  userId: string
}

const mapPaymentMethods: Record<PaymentMethod, string> = {
  NPP: 'RDC-C',
  CASH: 'CASH-C',
  UPI: 'CASH-D',
  SWIFT: 'DOM WIRE-C',
  GENERIC_BANK_ACCOUNT: 'DOM WIRE-D',
  ACH: 'DOM ACH-C',
  MPESA: 'DOM ACH-D',
  CARD: 'INTL WIRE-C',
  IBAN: 'INTL WIRE-D',
  WALLET: 'INTL ACH-C',
  CHECK: 'INTL ACH-D',
}

interface MemoizedData {
  tenantId: string
  user: InternalUser | null
  parentUser: InternalUser | null
  childUsers: InternalUser[]
  kycRiskScore: KrsScore | null
  craRiskScore: DrsScore | null
  riskLevels: RiskClassificationScore[]
  riskFactors: RiskFactor[]
  caseData: Case | null
  transactionAmountDataMap: Record<string, TransactionAmountAggregates>
  monthlyAverage: Record<string, MonthlyAverage[]>
  transactionAggregationsData: Array<{
    userId: string
    aggregationData: {
      trsScore: number
      transactionCount: number
      maxTransactionAmount: number
      minTransactionAmount: number
      averageTransactionAmount: number
      medianTransactionAmount: number
      totalTransactionAmount: number
    }
  }>
  transactionTypeData: Array<{
    userId: string
    transactionTypes: Array<{
      type: InternalTransaction['type']
      count: number
    }>
  }>
  paymentIdentifierData: Array<{
    userId: string
    paymentIdentifiers: Array<{
      paymentIdentifier: string
      paymentMethod: string
      count: number
      sum: number
      names: string[]
    }>
  }>
  sanctionsInformation: Partial<SanctionsHit>[]
  management: Record<
    string,
    { name: string; directors: Person[]; shareholders: Person[] }
  >
  auth0User: Account | null
  sars: Report[]
}

type ReturnData = { header: string; body: string } | null

export class EddReviewBatchJobRunner extends BatchJobRunner {
  private executionLogs: string[] = []
  private perplexitySearchResults: { title: string; url: string }[] = []
  private names: string[] = []

  /**
   * Get the complete execution log of the EDD review process
   * @returns Array of log entries with timestamps
   */
  public getExecutionLogs(): string[] {
    return [...this.executionLogs]
  }

  /**
   * Clear the execution logs (useful for resetting between runs)
   */
  public clearExecutionLogs(): void {
    this.executionLogs = []
  }

  private createTable(headers: string[], rows: string[][]): string {
    const maxWidths = headers.map((header, index) => {
      const columnValues = [header, ...rows.map((row) => row[index] || '')]
      return Math.max(...columnValues.map((val) => val.length))
    })

    const createRow = (cells: string[]) => {
      return `| ${cells
        .map((cell, index) => cell.padEnd(maxWidths[index]))
        .join(' | ')} |`
    }

    const separator = `| ${maxWidths
      .map((w) => '-'.repeat(Math.max(3, w)))
      .join(' | ')} |`

    const table = [
      createRow(headers),
      separator,
      ...rows.map((row) => createRow(row)),
    ].join('\n')

    return table
  }

  private async getPerplexityResponse(
    prompt: string,
    model: 'sonar' | 'sonar-pro' | 'sonar-reasoning' = 'sonar'
  ) {
    const perplexityApiKey = await getSecretByName('perplexity')
    const url = 'https://api.perplexity.ai/chat/completions'
    const headers = {
      Authorization: `Bearer ${perplexityApiKey.apiKey}`,
      'Content-Type': 'application/json',
    }

    // Define the request payload
    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
    }

    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as {
      choices: { message: { content: string } }[]
      search_results: { title: string; url: string }[]
    }

    const content = data.choices[0].message.content

    this.perplexitySearchResults.push(
      ...(data.search_results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
      }))
    )

    return content
      .replace(/```json\n|```/g, '')
      .replace(/```markdown\n|```/g, '')
      .replace(/\[\d+\]/g, '')
  }

  get sources(): { title: string; url: string }[] {
    return uniqBy(this.perplexitySearchResults, 'title')
  }

  private async loadUserData(
    tenantId: string,
    userId: string
  ): Promise<InternalUser | null> {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading user data from database for userId: ${userId}`
    )
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
    const user = await userRepository.getUserById(userId)
    this.executionLogs.push(
      `[${new Date().toISOString()}]: User data loaded: ${
        user ? 'SUCCESS' : 'NOT_FOUND'
      }`
    )
    return user
  }

  private async loadParentUserData(
    tenantId: string,
    parentUserId: string
  ): Promise<InternalUser | null> {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading parent user data for parentUserId: ${parentUserId}`
    )
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
    const parentUser = await userRepository.getUserById(parentUserId)
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Parent user data loaded: ${
        parentUser ? 'SUCCESS' : 'NOT_FOUND'
      }`
    )
    return parentUser
  }

  private async loadChildUsersData(
    tenantId: string,
    userId: string,
    parentUserId?: string
  ): Promise<InternalUser[]> {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading child users data for userId: ${userId}, parentUserId: ${
        parentUserId || 'N/A'
      }`
    )
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })

    const childUsers: InternalUser[] = []

    if (parentUserId) {
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Loading child users for parent user: ${parentUserId}`
      )
      const parentUserChilds = await userRepository.getChildUsers(parentUserId)
      childUsers.push(...parentUserChilds)
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Found ${
          parentUserChilds.length
        } child users for parent`
      )
    }

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading child users for current user: ${userId}`
    )
    const currentUserChilds = await userRepository.getChildUsers(userId)
    childUsers.push(...currentUserChilds)
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Found ${
        currentUserChilds.length
      } child users for current user`
    )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Total child users loaded: ${
        childUsers.length
      }`
    )
    return childUsers
  }

  private async loadRiskData(tenantId: string, userId: string) {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading risk data for userId: ${userId}`
    )
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const riskRepository = new RiskRepository(tenantId, { mongoDb, dynamoDb })

    const [kycRiskScore, craRiskScore, riskLevels, riskFactors] =
      await Promise.all([
        riskRepository.getKrsScore(userId),
        riskRepository.getDrsScore(userId),
        riskRepository.getRiskClassificationValues(),
        riskRepository.getAllRiskFactors(),
      ])

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Risk data loaded - KYC: ${
        kycRiskScore ? 'FOUND' : 'NOT_FOUND'
      }, CRA: ${craRiskScore ? 'FOUND' : 'NOT_FOUND'}, Levels: ${
        riskLevels.length
      }, Factors: ${riskFactors.length}`
    )
    return { kycRiskScore, craRiskScore, riskLevels, riskFactors }
  }

  private databaseClients = memoize(async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    return { mongoDb, dynamoDb }
  })

  private async loadCaseData(tenantId: string, caseId: string) {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading case data for caseId: ${caseId}`
    )
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const caseData = await caseRepository.getCaseById(caseId)
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Case data loaded: ${
        caseData ? 'SUCCESS' : 'NOT_FOUND'
      }`
    )
    return caseData
  }

  private async loadSanctionsData(tenantId: string, user: InternalUser) {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading sanctions data for user: ${getUserName(
        user
      )}`
    )
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const sanctionsService = new SanctionsService(tenantId, {
      mongoDb,
      dynamoDb,
    })

    const sanctionHitIds = uniq(
      compact(
        user.hitRules?.flatMap((hitRule) =>
          hitRule.ruleHitMeta?.sanctionsDetails?.flatMap(
            (sd) => sd.sanctionHitIds
          )
        )
      )
    )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Found ${
        sanctionHitIds.length
      } sanction hit IDs`
    )

    const sanctionsHits =
      await sanctionsService.sanctionsHitsRepository.getHitsByIds(
        sanctionHitIds ?? []
      )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Retrieved ${
        sanctionsHits.length
      } sanctions hits from database`
    )

    const sanctionsInformation: Partial<SanctionsHit>[] = sanctionsHits.map(
      (hit) => {
        const matchTypes = hit.entity.matchTypes
        const matchTypeDetails = hit.entity.matchTypeDetails
        return {
          hitId: hit.sanctionsHitId,
          matchTypes,
          matchTypeDetails,
          adverseMediaSources: hit.entity.mediaSources?.map((m) => ({
            media: m.media?.map((m) => ({ title: m.title })) ?? [],
            source: m.sourceName,
          })),
          sanctionsSources: hit.entity.sanctionsSources?.map((s) => ({
            source: s.sourceName,
            media: s.media?.map((m) => ({ title: m.title })) ?? [],
          })),
          screeningSources: hit.entity.screeningSources?.map((s) => ({
            source: s.sourceName,
            media: s.media?.map((m) => ({ title: m.title })) ?? [],
          })),
          pepSources: hit.entity.pepSources?.map((p) => ({
            source: p.sourceName,
            media: p.media?.map((m) => ({ title: m.title })) ?? [],
          })),
          otherSources: hit.entity.otherSources?.map((o) => ({
            type: o.type,
            value:
              o.value?.map((v) => ({
                media: v.media?.map((m) => ({ title: m.title })) ?? [],
              })) ?? [],
          })),
          pepStatus: hit.entity.pepStatus,
          isActivePep: hit.entity.isActivePep,
          isActiveSanctioned: hit.entity.isActiveSanctioned,
          isDeseased: hit.entity.isDeseased,
          profileImagesUrls: hit.entity.profileImagesUrls,
          dateOfBirths: hit.entity.dateOfBirths,
          provider: hit.entity.provider,
          addresses: hit.entity.addresses,
          normalizedAka: hit.entity.normalizedAka,
        }
      }
    )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Sanctions information processed: ${
        sanctionsInformation.length
      } entries`
    )
    return sanctionsInformation
  }

  private async loadTransactionData(
    tenantId: string,
    userId: string,
    parentUserId?: string,
    childUsers: InternalUser[] = []
  ) {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading transaction data for userId: ${userId}, parentUserId: ${
        parentUserId || 'N/A'
      }, childUsers: ${childUsers.length}`
    )
    const clickhouseClient = await getClickhouseClient(tenantId)
    const { dynamoDb } = await this.databaseClients()
    const transactionsRepository = new ClickhouseTransactionsRepository(
      clickhouseClient,
      dynamoDb,
      tenantId
    )

    const userIds = [
      userId,
      ...(parentUserId ? [parentUserId] : []),
      ...childUsers.map((u) => u.userId),
    ]
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Loading transaction data for ${
        userIds.length
      } users`
    )

    // Define the period for the last 6 months
    const period = {
      from: dayjs().subtract(6, 'months').valueOf(),
      to: dayjs().valueOf(),
    }

    // Load transaction aggregations data using the new query function
    const transactionAggregationsData = await pMap(
      userIds,
      async (currentUserId) => {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: Loading transaction aggregations for userId: ${currentUserId}`
        )

        const query = buildTransactionAggregationsQuery(
          currentUserId,
          undefined, // paymentIdentifier
          period
        )

        const result = await executeClickhouseQuery<
          Array<{
            trsScore: number
            transactionCount: number
            maxTransactionAmount: number
            minTransactionAmount: number
            averageTransactionAmount: number
            medianTransactionAmount: number
            totalTransactionAmount: number
          }>
        >(clickhouseClient, {
          query,
          format: 'JSONEachRow',
        })

        const aggregationData = result[0] || {
          trsScore: 0,
          transactionCount: 0,
          maxTransactionAmount: 0,
          minTransactionAmount: 0,
          averageTransactionAmount: 0,
          medianTransactionAmount: 0,
          totalTransactionAmount: 0,
        }

        return {
          userId: currentUserId,
          aggregationData,
        }
      },
      { concurrency: 5 }
    )

    // Load transaction type data using the new query function
    const transactionTypeData = await pMap(
      userIds,
      async (currentUserId) => {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: Loading transaction types for userId: ${currentUserId}`
        )

        const query = buildTransactionTypeQuery(
          currentUserId,
          undefined, // paymentIdentifier
          period
        )

        const result = await executeClickhouseQuery<
          Array<{ type: InternalTransaction['type']; count: number }>
        >(clickhouseClient, {
          query,
          format: 'JSONEachRow',
        })

        return {
          userId: currentUserId,
          transactionTypes: result,
        }
      },
      { concurrency: 5 }
    )

    // Load payment identifier data using the new query function
    const paymentIdentifierData = await pMap(
      userIds,
      async (currentUserId) => {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: Loading payment identifiers for userId: ${currentUserId}`
        )

        const query = buildPaymentIdentifierQuery(
          'from',
          'ORDER BY sum DESC LIMIT 10',
          currentUserId,
          period
        )

        const result = await executeClickhouseQuery<
          Array<{
            paymentIdentifier: string
            paymentMethod: string
            count: number
            sum: number
            names: string[]
          }>
        >(clickhouseClient, {
          query,
          format: 'JSONEachRow',
        })

        return {
          userId: currentUserId,
          paymentIdentifiers: result.map((r) => ({
            ...r,
            paymentMethod:
              mapPaymentMethods[r.paymentMethod] ?? r.paymentMethod,
          })),
        }
      },
      { concurrency: 5 }
    )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: All transaction data loaded successfully`
    )

    // Convert aggregations data to the expected format
    const transactionAmountDataMap = transactionAggregationsData.reduce(
      (acc, curr) => {
        acc[curr.userId] = {
          totalTransactions: curr.aggregationData.transactionCount,
          totalOriginAmount: curr.aggregationData.totalTransactionAmount,
          totalDeposits: curr.aggregationData.totalTransactionAmount, // Simplified mapping
          totalLoans: 0, // Would need additional logic to determine loans
          totalLoanBalance: 0, // Would need additional logic to determine loan balance
          totalAccounts: 1, // Simplified mapping
        } as TransactionAmountData
        return acc
      },
      {} as Record<string, TransactionAmountData>
    )

    // Load monthly average data using the original repository method
    const monthlyAverage = await Promise.all(
      userIds.map(async (currentUserId) => {
        const data = await transactionsRepository.getAverageByMethodTable({
          filterUserId: currentUserId,
        })
        return {
          userId: currentUserId,
          monthlyAverage: data.map((m) => ({
            method: m.method, // Keep original method name
            inLast12Months: m.inLast12Months,
            average: m.average,
          })),
        }
      })
    )

    const monthlyAverageMap = monthlyAverage.reduce((acc, curr) => {
      acc[curr.userId] = curr.monthlyAverage.map((m) => ({
        method: m.method, // Keep original method name
        inLast12Months: m.inLast12Months,
        average: m.average,
        userId: curr.userId,
      }))
      return acc
    }, {} as Record<string, MonthlyAverage[]>)

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Transaction data processing completed`
    )

    return {
      transactionAmountDataMap,
      monthlyAverage: monthlyAverageMap,
      transactionAggregationsData,
      transactionTypeData,
      paymentIdentifierData,
    }
  }

  private async loadManagementData(
    user: InternalUser,
    parentUser: InternalUser | null,
    childUsers: InternalUser[]
  ) {
    const management: Record<
      string,
      { name: string; directors: Person[]; shareholders: Person[] }
    > = {}

    if (parentUser) {
      management[parentUser.userId] = {
        name: getUserName(parentUser),
        directors: parentUser.directors ?? [],
        shareholders: parentUser.shareHolders ?? [],
      }
    }

    if (childUsers.length > 0) {
      childUsers.forEach((user) => {
        management[user.userId] = {
          name: getUserName(user),
          directors: user.directors ?? [],
          shareholders: user.shareHolders ?? [],
        }
      })
    }

    management[user.userId] = {
      name: getUserName(user),
      directors: user.directors ?? [],
      shareholders: user.shareHolders ?? [],
    }

    return management
  }

  private async loadAuth0UserData(auth0Domain: string, createdBy: string) {
    const { dynamoDb } = await this.databaseClients()
    const dynamoAccountsRepository = new DynamoAccountsRepository(
      auth0Domain,
      dynamoDb
    )
    return await dynamoAccountsRepository.getAccount(createdBy)
  }

  private data = memoize(
    async (job: EddReviewBatchJob): Promise<MemoizedData> => {
      const { userId } = job.parameters
      const { tenantId } = job

      // Load user data
      const user = await this.loadUserData(tenantId, userId)
      if (!user) {
        throw new Error(`User not found: ${userId}`)
      }

      // Load related data in parallel
      const [
        { kycRiskScore, craRiskScore, riskLevels, riskFactors },
        caseData,
        parentUser,
        childUsers,
        sanctionsInformation,
        auth0User,
      ] = await Promise.all([
        this.loadRiskData(tenantId, userId),
        this.loadCaseData(tenantId, job.parameters.caseId),
        user.linkedEntities?.parentUserId
          ? this.loadParentUserData(tenantId, user.linkedEntities.parentUserId)
          : Promise.resolve(null),
        this.loadChildUsersData(
          tenantId,
          userId,
          user.linkedEntities?.parentUserId
        ),
        this.loadSanctionsData(tenantId, user),
        this.loadAuth0UserData(
          job.parameters.auth0Domain,
          job.parameters.createdBy
        ),
      ])

      // Load child users and update transaction data
      const transactionData = await this.loadTransactionData(
        tenantId,
        userId,
        user.linkedEntities?.parentUserId,
        childUsers
      )

      // Load management data
      const management = await this.loadManagementData(
        user,
        parentUser,
        childUsers
      )

      const sars = await this.findSars(tenantId, [
        userId,
        ...(parentUser ? [parentUser.userId] : []),
        ...childUsers.map((u) => u.userId),
      ])

      return {
        user,
        parentUser,
        childUsers,
        kycRiskScore,
        craRiskScore,
        riskLevels,
        caseData,
        transactionAmountDataMap: transactionData.transactionAmountDataMap,
        monthlyAverage: transactionData.monthlyAverage,
        transactionAggregationsData:
          transactionData.transactionAggregationsData,
        transactionTypeData: transactionData.transactionTypeData,
        paymentIdentifierData: transactionData.paymentIdentifierData,
        sanctionsInformation,
        management,
        auth0User,
        sars,
        tenantId,
        riskFactors,
      }
    }
  )

  private async findSars(
    tenantId: string,
    userIds: string[]
  ): Promise<Report[]> {
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const reportRepository = new ReportRepository(tenantId, mongoDb, dynamoDb)
    const reports = await reportRepository.getReportsByUserIds(userIds)
    return reports
  }

  private generateClientInformationSection(data: MemoizedData): ReturnData {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating Client Information section`
    )
    const { user, craRiskScore, riskLevels, transactionAmountDataMap } = data

    if (!user) {
      return null
    }

    const transactionAmounts = transactionAmountDataMap[user.userId]
    const totalTransactions = transactionAmounts.totalTransactions
    const name = getUserName(user)
    const clientType = humanizeAuto(user.type)
    const reviewPeriod = `${dayjs()
      .subtract(6, 'months')
      .format(DATE_FORMAT)} - ${dayjs().format(DATE_FORMAT)}`
    const riskRating = `${craRiskScore?.drsScore?.toPrecision(
      2
    )} (${getRiskLevelFromScore(riskLevels, craRiskScore?.drsScore ?? null)})`
    let clientInformation = `- **Client Name:** ${name}\n- **Client Id:** ${user.userId}\n- **Client Type:** ${clientType}\n- **Review period:** ${reviewPeriod}\n- **Risk Rating:** ${riskRating}\n`
    if (totalTransactions > 0) {
      clientInformation += `- **Total $ Exposures:** $${transactionAmounts.totalOriginAmount.toLocaleString()}\n- **Deposit $:** $${transactionAmounts.totalDeposits.toLocaleString()}\n- **Loan $:** $${transactionAmounts.totalLoans.toLocaleString()}\n`
    }

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Client Information section generated successfully`
    )

    return {
      header: 'Client Information',
      body: clientInformation,
    }
  }

  private generateCustomerOrClientInformationSection(
    data: MemoizedData
  ): ReturnData {
    const {
      user,
      parentUser,
      childUsers,
      transactionAmountDataMap,
      riskLevels,
      craRiskScore,
    } = data
    if (!user) {
      return null
    }

    const clientData = Object.entries(transactionAmountDataMap).map(
      ([userId, amount]) => {
        // Find the user object for this userId
        let u:
          | typeof user
          | typeof parentUser
          | (typeof childUsers)[0]
          | undefined

        if (user.userId === userId) {
          u = user
        } else if (parentUser && parentUser.userId === userId) {
          u = parentUser
        } else {
          u = childUsers.find((child) => child.userId === userId)
        }

        // Try to get the risk score for this user
        // Prefer krsScore if present, else craRiskScore?.drsScore
        let riskScore: number | undefined
        if (u && typeof u.krsScore === 'number') {
          riskScore = u.krsScore
        } else if (
          u &&
          typeof u.krsScore === 'object' &&
          u.krsScore !== null &&
          'krsScore' in u.krsScore
        ) {
          riskScore = (u.krsScore as any).krsScore
        } else if (craRiskScore?.drsScore !== undefined) {
          riskScore = craRiskScore.drsScore
        }

        // Risk level
        const riskLevel = getRiskLevelFromScore(
          riskLevels,
          riskScore || getRiskScoreFromLevel(riskLevels, DEFAULT_RISK_LEVEL)
        )

        return {
          userId,
          userName: u ? getUserName(u) : getUserName(user),
          createdTimestamp: u
            ? dayjs(u.createdTimestamp).format('DD/MM/YYYY')
            : '',
          riskScore,
          riskLevel,
          amount,
        }
      }
    )

    return {
      header: 'Customer or Client Information',
      body: this.createTable(
        [
          'CIF',
          'Entity Name',
          'Original Customer Date',
          'Deposit Accounts',
          'Deposit Balance',
          'Loans',
          'Loan Balance',
          'Total Amount',
        ],
        clientData.map((d) => [
          d.userId,
          d.userName,
          d.createdTimestamp,
          `${d.amount.totalAccounts.toLocaleString()}`,
          `$${d.amount.totalDeposits.toLocaleString()}`,
          `${
            d.amount.totalLoans
              ? `$${d.amount.totalLoans.toLocaleString()}`
              : 'N/A'
          }`,
          `${
            d.amount.totalLoanBalance
              ? `$${d.amount.totalLoanBalance.toLocaleString()}`
              : 'N/A'
          }`,
          `$${d.amount.totalOriginAmount.toLocaleString()}`,
        ])
      ),
    }
  }

  private generateCompanyBackgroundSection(data: MemoizedData): ReturnData {
    const { user, parentUser, childUsers } = data
    if (!user) {
      return null
    }

    const details = [user, ...(parentUser ? [parentUser] : []), ...childUsers]

    const companyBackground = details
      .filter((u): u is InternalUser => u !== null && isBusinessUser(u))
      .map((curr) => {
        const reg = curr.legalEntity?.companyRegistrationDetails
        const tags = reg?.tags || []
        const getTag = (key: string) => tags.find((t) => t.key === key)?.value
        return {
          userId: curr.userId,
          name: getUserName(curr),
          address: getAddress(curr),
          taxIdentifier: reg?.taxIdentifier,
          registrationCountry: reg?.registrationCountry,
          taxResidenceCountry:
            reg?.taxResidenceCountry ?? reg?.registrationCountry,
          legalEntityType: reg?.legalEntityType,
          dateOfRegistration: reg?.dateOfRegistration,
          nacis: getTag('NAICS'),
          sos: getTag('SOS (State)'),
        }
      })

    const companyBackgroundTable = this.createTable(
      [
        'CIF',
        'Entity Name',
        'Principal Address',
        'TIN',
        'NAICS',
        'SOS (State)',
        'Registration Country',
        'Tax Residence Country',
        'Legal Entity Type',
        'Date of Formation',
      ],
      companyBackground.map((d) => [
        d.userId,
        d.name,
        d.address,
        d.taxIdentifier || '',
        d.nacis || '',
        d.sos || '',
        d.registrationCountry || '',
        d.taxResidenceCountry || '',
        d.legalEntityType || '',
        d.dateOfRegistration || '',
      ])
    )

    return {
      header: 'Company Background',
      body: companyBackgroundTable,
    }
  }

  private async generateCompanyInformationSection(
    tenantId: string,
    data: MemoizedData
  ): Promise<ReturnData> {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating Company Information section`
    )
    const { user, parentUser, childUsers } = data
    if (!user) {
      this.executionLogs.push(
        `[${new Date().toISOString()}]: No user data available for Company Information section`
      )
      return null
    }

    const details = [user, ...(parentUser ? [parentUser] : []), ...childUsers]

    const companyInformation = details
      .filter((u): u is InternalUser => u !== null && isBusinessUser(u))
      .map((curr) => {
        const reg = curr.legalEntity?.companyRegistrationDetails
        const tags = reg?.tags || []
        const getTag = (key: string) => tags.find((t) => t.key === key)?.value
        return {
          userId: curr.userId,
          name: getUserName(curr),
          address: getAddress(curr),
          taxIdentifier: reg?.taxIdentifier,
          registrationCountry: reg?.registrationCountry,
          taxResidenceCountry:
            reg?.taxResidenceCountry ?? reg?.registrationCountry,
          legalEntityType: reg?.legalEntityType,
          dateOfRegistration: reg?.dateOfRegistration,
          nacis: getTag('NAICS'),
          sos: getTag('SOS (State)'),
          comments: curr.comments,
        }
      })

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Processing ${
        companyInformation.length
      } companies for background information`
    )

    const informationRelatedToCompanies = await pMap(
      companyInformation,
      async (d) => {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: Generating background info for company: ${
            d.name
          }`
        )

        const comments = d.comments
        let prompt = `Please provide a markdown summary for the company "${
          d.name
        }". Include a brief description of the company, its business activities, and any relevant compliance considerations. ${
          isBusinessUser(user) && d.registrationCountry
            ? `The company is registered in ${d.registrationCountry}. Give as a paragraph.`
            : ''
        }`

        if (comments) {
          prompt += `\n\nConsider the following comments including your own knowledge: \n\n${comments
            .map((c) => `- ${c.body}`)
            .join('\n')}`
        }

        const response = await this.getPerplexityResponse(prompt)

        this.executionLogs.push(
          `[${new Date().toISOString()}]: Generated background information for company ${
            d.name
          }`
        )

        return { userId: d.userId, response, name: d.name }
      },
      { concurrency: 3 }
    )

    let text = ''
    // remove references like [1] [2] [3]
    for (const info of informationRelatedToCompanies) {
      text += `### ${info.name}\n\n${info.response.replace(
        /\[[0-9]+\]/g,
        ''
      )}\n\n\n`
    }

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Company Information section generated successfully`
    )
    return {
      header: `Background Information`,
      body: text,
    }
  }

  private parseCompanyInformation(data: MemoizedData): ReturnData {
    const { parentUser } = data

    return {
      header: `Parent Company Information (If Applicable)`,
      body: parentUser
        ? `${getUserName(
            parentUser
          )} is the parent company for all the subsidiaries.`
        : 'N/A',
    }
  }

  private parseSubsidiariesInformation(data: MemoizedData): ReturnData {
    const { childUsers, user } = data
    return {
      header: `Affiliates AND / OR Subsidiaries (If Applicable)`,
      body: childUsers
        ? `These are the subsidiaries of ${getUserName(user)}\n\n${childUsers
            .map((u) => `- ${getUserName(u)}`)
            .join('\n')}`
        : 'N/A',
    }
  }

  private generateBeneficialOwnersSection(data: MemoizedData): ReturnData {
    const { user, management } = data
    if (!user) {
      return null
    }

    const beneficialOwners = Object.entries(management).map(([userId, m]) => {
      return {
        userId,
        name: m.name,
        directorNames: m.directors.map((d) => getPersonName(d)).join(', '),
        shareholderNames: m.shareholders
          .map((s) => getPersonName(s))
          .join(', '),
      }
    })

    const beneficialOwnersTable = this.createTable(
      [
        'CIF',
        'Entity Name',
        'Beneficial Owners %',
        'Directors',
        'Shareholders',
      ],
      beneficialOwners.map((d) => [
        d.userId,
        d.name,
        'N/A',
        d.directorNames,
        d.shareholderNames,
      ])
    )

    return {
      header: 'BENEFICIAL OWNER AND CONTROL PERSON',
      body: beneficialOwnersTable,
    }
  }

  private management = memoize(async (data: MemoizedData) => {
    const { user, tenantId, parentUser } = data
    if (!user) {
      return null
    }

    const shareHolders = compact(
      user.shareHolders?.map((s) => getPersonName(s))
    )

    const directors = compact(user.directors?.map((d) => getPersonName(d)))
    const peopleToSearch = uniq(compact([...shareHolders, ...directors]))

    // HACK FOR DEMO
    const companyName =
      getUserName(user) === 'Generous Star Ventures Limited'
        ? 'Alvarez & Marsal Limited'
        : getUserName(user)

    const gptPrompt = `Provide a JSON array of the exact full names of all individuals who are shareholders, founders, directors, C-level executives, or senior management of "${companyName}" or its parent "${
      parentUser ? getUserName(parentUser) : ''
    }" and its direct subsidiaries only. 
  
    Like Directors, Shareholders of the company are ${peopleToSearch}

Strict rules:  
- Include only individuals directly employed by or holding executive/board roles at the company.  
- Exclude independent trustees, fund board members, external advisors, consultants, or members of affiliated investment trusts.  
- Only use official sources: company website, official press releases, SEC filings referencing the company directly.  
- Return strictly a JSON array of names only. Do not include titles, roles, explanations, or any starting or ending text
- Also include the names I have provided in the list.
    `

    const gptResponse = await ask(tenantId, gptPrompt, {
      provider: 'OPEN_AI',
      tier: ModelTier.ENTERPRISE,
      maxTokens: 1000,
      temperature: 0.1,
    })

    const allNames = JSON.parse(
      gptResponse.replace('```json', '').replace('```', '')
    ) as string[]

    const namesToSearch = uniq([...allNames, ...shareHolders, ...directors])
    const inShortOrLong = namesToSearch.length > 3 ? 'short' : 'very detailed'

    let text = ''
    await pMap(
      namesToSearch,
      async (name) => {
        const prompt = `Generate a ${inShortOrLong} professional profile for ${name} who works in ${companyName} or its parent ${
          parentUser ? getUserName(parentUser) : ''
        } using only publicly available and verifiable sources such as LinkedIn, company websites, press releases, news articles, official regulatory filings, and publications. The profile should include their education (degrees, universities, majors/specializations), career history (roles, companies, periods), notable projects or entrepreneurial initiatives, publications, achievements (professional, personal, awards, recognitions) or patents authored, and any awards or recognitions or media presence. Include professional links like LinkedIn or company bios where relevant. In a paragraph format you can have ${
          inShortOrLong === 'short' ? 'single' : 'multiple'
        } paragraphs. Do not have paragraphs of what you don't know even don't explain it. `

        const response = await this.getPerplexityResponse(prompt)

        text += `**${name}**: ${response}\n\n\n`
      },
      { concurrency: 5 }
    )

    this.names.push(...namesToSearch)

    return {
      header: 'Management',
      body: text,
    }
  })

  private async generateSanctionsSummarySection(
    data: MemoizedData,
    tenantId: string
  ): Promise<ReturnData> {
    const { user, sanctionsInformation } = data

    const sanctionsSummary = await ask(
      tenantId,
      `
        Please provide a comprehensive, concise, and professional summary of all sanctions-related information for ${getUserName(
          user
        )}, using both the provided data and your own knowledge base. 

        Data: ${JSON.stringify({ sanctionsInformation })}

        Your response should be in clear, factual language suitable for compliance and due diligence documentation. Structure your answer in markdown format with the following sections, using short, well-organized paragraphs (no bullet points):

        ### Sanctions Summary
        Summarize any known sanctions, watchlists, or enforcement actions involving the subject, including relevant dates, authorities, and outcomes.

        ### OFAC Exposure
        Detail any exposure or connections to OFAC lists, including SDN, SSI, or other relevant designations, and describe the nature and implications of any such exposure.

        If no information is found for a section, state "No relevant information identified." Ensure the summary is suitable for inclusion in a compliance review report.
      `,
      { provider: 'OPEN_AI', tier: ModelTier.STANDARD, maxTokens: 4096 }
    )

    return {
      header: 'Sanctions Summary',
      body: sanctionsSummary,
    }
  }

  private async generateNegativeNewsSection(
    data: MemoizedData,
    tenantId: string
  ): Promise<ReturnData> {
    const negativeNews = await this.dueDiligenceSection(tenantId, data)
    let fullNegativeNews = ''
    for (const name of Object.keys(negativeNews.negativeNews)) {
      if (negativeNews.negativeNews[name]) {
        fullNegativeNews += `** ${name}: ${negativeNews.negativeNews[name]}\n\n`
      }
    }

    const { user } = data

    const prompt = `Please provide a comprehensive summary of any negative news identified for ${getUserName(
      user
    )}, its parent, or subsidiaries. Focus strictly on incidents involving financial crime, fraud, mismanagement, negligence, money laundering, sanctions violations, BSA/AML issues, regulatory enforcement, lawsuits, arrests, criminal activity, OFAC, convictions, corruption, or schemes. Exclude unrelated companies. The summary should be written as a single, well-structured paragraph suitable for inclusion in a compliance review report. `

    const summary = await this.getPerplexityResponse(prompt, 'sonar-pro')

    return {
      header: 'Negative News',
      body: `${summary}\n\n${fullNegativeNews}`,
    }
  }

  private async generateRiskSummarySection(
    data: MemoizedData,
    tenantId: string
  ): Promise<ReturnData> {
    const { user, kycRiskScore, craRiskScore, riskLevels, riskFactors } = data

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating Risk Summary section`
    )

    const riskSummary = await ask(
      tenantId,
      `
        Please provide a summary of the risk related to ${getUserName(user)} 

        Data: ${JSON.stringify({
          krsScore: {
            krsScore: kycRiskScore?.krsScore,
            ...(kycRiskScore?.factorScoreDetails?.length
              ? { factorScoreDetails: kycRiskScore?.factorScoreDetails }
              : {}),
            ...(kycRiskScore?.components?.length
              ? { components: kycRiskScore?.components }
              : {}),
            riskLevel: getRiskLevelFromScore(
              riskLevels,
              kycRiskScore?.krsScore ??
                getRiskScoreFromLevel(riskLevels, DEFAULT_RISK_LEVEL)
            ),
          },
          craRiskScore: {
            drsScore: craRiskScore?.drsScore,
            riskLevel: getRiskLevelFromScore(
              riskLevels,
              craRiskScore?.drsScore ??
                getRiskScoreFromLevel(riskLevels, DEFAULT_RISK_LEVEL)
            ),
            ...(craRiskScore?.factorScoreDetails?.length
              ? { factorScoreDetails: craRiskScore?.factorScoreDetails }
              : {}),
            ...(craRiskScore?.components?.length
              ? { components: craRiskScore?.components }
              : {}),
          },
          riskFactors: riskFactors.map((f) => ({
            name: f.name,
            description: f.description,
            id: f.id,
            riskFactorLogic: f.riskLevelLogic,
            logicAggregationVariables: f.logicAggregationVariables,
            logicEntityVariables: f.logicEntityVariables,
            defaultWeight: f.defaultWeight,
            defaultRiskLevel: f.defaultRiskLevel,
            defaultRiskScore: f.defaultRiskScore,
            riskLevelAssignmentValues: f.riskLevelAssignmentValues,
            parameter: f.parameter,
          })),
        })}

        Write in markdown format in short and concise manner.

        ### Risk Summary

        ### Risk Mitigation (in bullet points)

        `,
      { provider: 'OPEN_AI', tier: ModelTier.PROFESSIONAL }
    )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Risk Summary section generated successfully`
    )

    return {
      header: 'Risk Section',
      body: riskSummary.replace('```markdown', '').replace('```', ''),
    }
  }

  private generateRemarksSection(data: MemoizedData): ReturnData {
    const { auth0User } = data
    const auth0UserEmail = auth0User?.email

    return {
      header: 'Remarks',
      body: `Prepared By: ${
        auth0UserEmail ? `${auth0UserEmail}` : ''
      }\nDate: ${dayjs().format('DD/MM/YYYY')}`,
    }
  }

  private async licenseSection(data: MemoizedData): Promise<ReturnData> {
    const { user, childUsers, parentUser } = data

    const entities = uniq(
      compact([
        getUserName(user),
        ...childUsers.map((u) => getUserName(u)),
        parentUser ? getUserName(parentUser) : null,
      ])
    )

    const prompt = `
  I want a comprehensive overview of all licenses, registrations, and regulatory filings for ${
    parentUser ? getUserName(parentUser) : getUserName(user)
  } and the following subsidiaries: ${entities.join(
      ', '
    )}. For each entity, provide the following information in a table format:
Entity / Subsidiary Name

Type of License or Registration (e.g., SEC Form D, state license, FINRA registration, CFTC registration, etc.)

Regulatory Authority / Issuer

License or Registration Number (if applicable)

Date of Issue / Filing Date

Status (active, pending, revoked, etc.)

Reference / Link to official filing or registry

Use official sources such as regulatory databases, government websites, filings portals, offering memoranda, or company disclosures. Present the output in a clean, structured table for easy reference.
  `

    const response = await this.getPerplexityResponse(prompt)

    return {
      header: 'License Section',
      body: response,
    }
  }

  private async relatedPartiesSection(data: MemoizedData): Promise<ReturnData> {
    const { user, parentUser } = data

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating related parties section`
    )

    const prompt = `
      Please provide a summary of the related parties for ${getUserName(
        user
      )} ${parentUser ? `or ${getUserName(parentUser)}` : ''}
      Keep it in form of paragraphs.
      If you cannot find any related parties with correct information, state "No relevant related parties identified."
    `

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Making Flagright AI call for related parties`
    )

    const response = await this.getPerplexityResponse(prompt, 'sonar-pro')

    return {
      header: 'Related Parties',
      body: response,
    }
  }

  private async sharingRequest314A(_data: MemoizedData): Promise<ReturnData> {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating sharing request 314A section`
    )

    return {
      header: 'Sharing Request 314A',
      body: 'N/A',
    }
  }

  private async generateTransactionsReviewSection(
    data: MemoizedData
  ): Promise<ReturnData> {
    const { user } = data

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating transactions review section`
    )

    // Get monthly average data for the user
    const userMonthlyAverage =
      data.monthlyAverage?.[(user as InternalUser).userId] ?? []

    // Create a map for easier lookup
    const monthlyAverageMap = new Map(
      userMonthlyAverage.map((m) => [m.method, m])
    )

    const monthlyAverage = PAYMENT_METHODS.map((method) => {
      // Find the data for this payment method
      const methodData = monthlyAverageMap.get(method)

      // Parse as numbers, fallback to 0 if not present or not a valid number
      const inLast12Months = Number(methodData?.inLast12Months) || 0
      const average = Number(methodData?.average) || 0

      return {
        method: mapPaymentMethods[method] ?? method,
        limit:
          user?.transactionLimits?.paymentMethodLimits?.[method]
            ?.averageTransactionAmountLimit?.month?.amountValue,
        inLast12Months,
        average,
        variance: inLast12Months - average,
        variancePercentage:
          average !== 0 ? ((inLast12Months - average) / average) * 100 : 0,
      }
    })

    const table = this.createTable(
      [
        'Method',
        'Limit',
        'In Last 12 Months',
        'Average',
        'Variance',
        'Variance Percentage',
      ],
      monthlyAverage.map((m) => [
        mapPaymentMethods[m.method] ?? m.method,
        m.limit ? `$${m.limit.toLocaleString()}` : 'N/A',
        m.inLast12Months ? m.inLast12Months.toLocaleString() : 'N/A',
        m.average ? m.average.toLocaleString() : 'N/A',
        m.variance ? m.variance.toLocaleString() : 'N/A',
        m.variancePercentage ? m.variancePercentage.toLocaleString() : 'N/A',
      ])
    )

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Transactions review section generated successfully`
    )

    const allUsers = uniq(
      compact([data.user, data.parentUser, ...data.childUsers])
    )

    let transactionsReviewText = ''

    for (const user of allUsers) {
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Generating transactions review section for ${getUserName(
          user
        )}`
      )
      const monthlyAverage = data.monthlyAverage[user.userId]
      const paymentIdentifierData = data.paymentIdentifierData.find(
        (p) => p.userId === user.userId
      )
      const transactionTypeData = data.transactionTypeData.find(
        (t) => t.userId === user.userId
      )
      const transactionAggregationsData = data.transactionAggregationsData.find(
        (t) => t.userId === user.userId
      )
      transactionsReviewText += `### ${user.userId} ${getUserName(
        user
      )} Summary of Deposit Activity\n\n`
      const transactionsData = data.transactionAmountDataMap[user.userId]
      const gptAskPrompt = `
        Please provide a summary of the deposit activity for ${getUserName(
          user
        )} 
        Data: ${JSON.stringify({
          monthlyAverage: monthlyAverage.map((m) => ({
            method: mapPaymentMethods[m.method] ?? m.method,
          })),
          transactionsData,
          paymentIdentifierData,
          transactionTypeData,
          transactionAggregationsData,
        })}
        Keep it in form of paragraphs only.
        If no data write "During the review period, there are no transactions."
        Do not add raw data or any array which is provided in the data.
        `
      const gptAskResponse = await this.getPerplexityResponse(gptAskPrompt)
      transactionsReviewText += `\n\n${gptAskResponse}\n\n`
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Transactions review section generated successfully for ${getUserName(
          user
        )}`
      )
    }

    return {
      header: 'Transactions Review',
      body: `### Combined Activity\n\n${table}\n\n${transactionsReviewText}`,
    }
  }

  private async saveComment(
    tenantId: string,
    caseId: string,
    finalDraft: string,
    files: FileInfo[] = []
  ): Promise<void> {
    const { mongoDb, dynamoDb } = await this.databaseClients()
    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    await caseRepository.saveComment(caseId, {
      body: finalDraft,
      files,
    })
  }

  private generateSarsSection(data: MemoizedData): ReturnData {
    const { sars } = data
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating SARs section`
    )
    const allUsers = uniq(
      compact([data.user, data.parentUser, ...data.childUsers])
    )
    const table = this.createTable(
      ['CIF', 'Item ID', 'Item Date', 'Item Type', 'Step', 'Linked Case'],
      allUsers.map((u) => {
        const userSars = sars.find((s) => s.caseUserId === u.userId)
        return [
          u.userId,
          userSars?.id ?? 'N/A',
          userSars?.createdAt
            ? dayjs(userSars.createdAt).format('DD/MM/YYYY')
            : 'N/A',
          userSars?.reportTypeId ?? 'N/A',
          userSars?.status ?? 'N/A',
          userSars?.caseId ?? 'N/A',
        ]
      })
    )
    this.executionLogs.push(
      `[${new Date().toISOString()}]: SARs section generated successfully`
    )
    return {
      header: 'Suspicious Activity Monitoring History',
      body: table,
    }
  }

  private async getFinancialInformation(
    tenantId: string,
    data: MemoizedData
  ): Promise<ReturnData> {
    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating financial information section`
    )

    const s3Client = getS3Client()

    const attachments =
      data.user?.attachments?.filter((a) =>
        a.tags?.includes('financial_information')
      ) || []

    if (!attachments?.length) {
      return {
        header: 'Financial Information',
        body: 'N/A',
      }
    }

    let financialInformationText = ''

    const filesCount = attachments.flatMap((a) => a.files).length

    this.executionLogs.push(
      `[${new Date().toISOString()}]: Generating financial information section for ${filesCount} attachments`
    )

    for (const attachment of attachments) {
      for (const file of attachment.files) {
        const s3Key = file.s3Key
        this.executionLogs.push(
          `[${new Date().toISOString()}]: Downloading attachment ${s3Key}`
        )
        const attachmentFile = await s3Client.send(
          new GetObjectCommand({
            Bucket: process.env.DOCUMENT_BUCKET || '',
            Key: s3Key,
          })
        )

        this.executionLogs.push(
          `[${new Date().toISOString()}]: Downloaded attachment ${s3Key}`
        )

        const pdfExtractionService = new PDFExtractionService()
        const pdfText = await pdfExtractionService.extractText(
          Buffer.from((await attachmentFile.Body?.transformToByteArray()) || '')
        )

        const prompt = `Summarize the financial information below in clear, concise markdown. Focus on key figures, trends, and important details. Do not include any information not present in the text. If the text does not contain financial information, respond with "No financial information found."
Do not include any information which in not related or useful for compliance audit and ease of understanding. No headings or subheadings only bullet points or paragraphs or bold text.
Text:
${pdfText.text.substring(0, 10000)}
`

        this.executionLogs.push(
          `[${new Date().toISOString()}]: Making Flagright AI call for financial information for ${s3Key}`
        )

        const response = await ask(tenantId, prompt, {
          provider: 'OPEN_AI',
          tier: ModelTier.PROFESSIONAL,
          maxTokens: 4096,
          temperature: 0.1,
        })

        this.executionLogs.push(
          `[${new Date().toISOString()}]: Financial information for ${s3Key} generated successfully`
        )

        financialInformationText += `\n\n${response}`
      }
    }

    if (filesCount > 1) {
      const prompt = `
Combine the following markdown summaries of financial information from multiple attachments into a single, well-organized markdown document. Remove any duplicate information and ensure the summary is clear and concise.
Segregate in a very well manner. Only H3 or H4 or H5 or H6 or bold text or paragraphs or bullet points.
Summaries:
${financialInformationText}
`

      const response = await ask(tenantId, prompt, {
        provider: 'OPEN_AI',
        tier: ModelTier.PROFESSIONAL,
        maxTokens: 10000,
        temperature: 0.1,
      })

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Financial summary generated successfully`
      )

      financialInformationText = response
    }

    return {
      header: 'Financial Information',
      body: financialInformationText,
    }
  }

  private dueDiligenceSection = memoize(
    async (
      tenantId: string,
      data: MemoizedData
    ): Promise<
      ReturnData & { negativeNews: Record<string, string | null> }
    > => {
      const { management } = data
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Searching for names in management section`
      )

      const namesToSearch = [...this.names]

      namesToSearch.push(getUserName(data.user))
      namesToSearch.push(getUserName(data.parentUser))
      namesToSearch.push(...data.childUsers.map((u) => getUserName(u)))

      Object.values(management).forEach((m) => {
        namesToSearch.push(...m.directors.map((d) => getPersonName(d)))
        namesToSearch.push(...m.shareholders.map((s) => getPersonName(s)))
      })

      const uniqNamesToSearch = uniq(namesToSearch).filter((n) => n !== '-')
      const tableData: {
        name: string
        isNegative: boolean
        response: string | null
      }[] = []

      const negativeNews: Record<string, string | null> = {}

      await pMap(
        compact(uniqNamesToSearch.flat()),
        async (name) => {
          this.executionLogs.push(
            `[${new Date().toISOString()}]: Making Flagright AI call for negative news for ${name}`
          )
          const perplexityPrompt = `Check if there has been any negative news related to ${name} that involves financial crime (fraud, money laundering, sanctions violations, mismanagement, or regulatory enforcement), lawsuits, arrests, terrorism, BSA, criminal activity, OFAC, convictions, smuggling, trafficking, drugs, corruption, schemes, or consultants. Do not include results for other products or entities with similar names—focus strictly on ${name}. If no such negative news is found, return exactly "NO".`

          const perplexityResponse = await this.getPerplexityResponse(
            perplexityPrompt,
            'sonar-pro'
          )

          this.executionLogs.push(
            `[${new Date().toISOString()}]: Making Flagright AI call for negative news for ${name} completed`
          )

          const isNo = await ask(
            tenantId,
            `Is the Response from Perplexity for Negative News is "NO"?
          Response: ${perplexityResponse}
          If the response is "NO", return "YES". If the response is not negative, return "NO". Strictly return "YES" or "NO"
          `,
            {
              provider: 'OPEN_AI',
              tier: ModelTier.ECONOMY,
              maxTokens: 100,
              temperature: 0.1,
            }
          )

          negativeNews[name] = isNo === 'YES' ? null : perplexityResponse

          tableData.push({
            name,
            isNegative: isNo === 'YES',
            response: isNo === 'YES' ? null : perplexityResponse,
          })
        },
        { concurrency: 10 }
      )

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Due diligence section generated successfully`
      )

      return {
        header: 'Due Diligence',
        body: this.createTable(
          ['Name', 'Lexis Nexis', 'Internet Search'],
          tableData.map((d) => [
            d.name,
            'N/A',
            d.response ? `See below` : 'No negative results found',
          ])
        ),
        negativeNews,
      }
    }
  )

  protected async run(job: EddReviewBatchJob): Promise<void> {
    const { tenantId } = job

    try {
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Starting EDD review batch job for case: ${
          job.parameters.caseId
        }, userId: ${job.parameters.userId}`
      )

      const data = await this.data(job)

      if (!data.user) {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: ERROR: User not found for userId: ${
            job.parameters.userId
          }`
        )
        return
      }

      this.executionLogs.push(
        `[${new Date().toISOString()}]: All data loaded successfully, starting section generation`
      )

      const sections: ReturnData[] = [
        this.generateClientInformationSection(data),
        this.generateCustomerOrClientInformationSection(data),
        this.generateCompanyBackgroundSection(data),
        await this.generateCompanyInformationSection(tenantId, data),
        await this.licenseSection(data),
        this.parseCompanyInformation(data),
        this.parseSubsidiariesInformation(data),
        this.generateBeneficialOwnersSection(data),
        await this.management(data),
        await this.relatedPartiesSection(data),
        await this.getFinancialInformation(tenantId, data),
        await this.generateTransactionsReviewSection(data),
        await this.sharingRequest314A(data),
        this.generateSarsSection(data),
        await this.dueDiligenceSection(tenantId, data),
        await this.generateSanctionsSummarySection(data, tenantId),
        await this.generateNegativeNewsSection(data, tenantId),
        await this.generateRiskSummarySection(data, tenantId),
        this.generateRemarksSection(data),
      ]

      this.executionLogs.push(
        `[${new Date().toISOString()}]: All sections generated, assembling final document`
      )

      let finalText = `# Enhanced Due Diligence (EDD) and Compliance Review for ${getUserName(
        data.user
      )}`

      for (const section of sections) {
        if (section) {
          finalText += `\n\n## ${section.header}\n\n${section.body}`
        }
      }

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Converting markdown to HTML`
      )

      finalText += `\n\n## Sources\n\n${this.sources
        .map((r) => `- [${r.title}](${r.url})`)
        .join('\n')}
      `

      const html = await marked.parse(finalText)

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Converting HTML to DOCX format`
      )
      const docx = await htmlToDocx(html, undefined, {
        margins: { top: 540, bottom: 540, left: 540, right: 540 }, // 0.75 inch = 540pt
        font: 'Noto Sans',
      })

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Initializing S3 client`
      )
      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
      })

      logger.info('Uploading DOCX document to S3 bucket')

      const s3Key = `edd-review/${job.parameters.caseId}-${dayjs().format(
        'YYYY-MM-DD-HH-mm-ss'
      )}.docx`

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Preparing to upload document to S3: ${s3Key}`
      )

      let body: Uint8Array

      if (docx instanceof Blob) {
        const arrayBuffer = await docx.arrayBuffer()
        body = new Uint8Array(arrayBuffer)
      } else {
        body = new Uint8Array(docx)
      }

      this.executionLogs.push(
        `[${new Date().toISOString()}]: Uploading DOCX document to S3 bucket: ${
          process.env.TMP_BUCKET
        }`
      )
      const { mongoDb } = await this.databaseClients()

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.DOCUMENT_BUCKET || '',
          Key: s3Key,
          Body: body,
        })
      )
      this.executionLogs.push(
        `[${new Date().toISOString()}]: Document uploaded to S3 successfully`
      )

      try {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: EDD review batch job completed successfully`
        )

        logger.info('Saving comment to case: ', {
          caseId: job.parameters.caseId,
          comment: this.executionLogs.join('\n'),
        })

        const comment = `## EDD Review Logs\n\n${this.executionLogs.join(
          '\n'
        )}\n\n## Sources\n\n${this.sources
          .map((r) => `- [${r.title}](${r.url})`)
          .join('\n')}`

        logger.info('Saving comment to case: ', {
          caseId: job.parameters.caseId,
          comment,
        })

        const { transactionAmountDataMap } = await this.data(job)
        const eddRepository = new EddRepository(tenantId, mongoDb)

        await eddRepository.createEddReview({
          caseId: job.parameters.caseId,
          userId: job.parameters.userId,
          review: finalText,
          id: uuidv4(),
          createdAt: dayjs().valueOf(),
          updatedAt: dayjs().valueOf(),
          createdBy: job.parameters.userId,
          updatedBy: job.parameters.userId,
          periodStart: Object.keys(transactionAmountDataMap).length
            ? dayjs().subtract(6, 'months').valueOf()
            : dayjs().valueOf(),
          periodEnd: Object.keys(transactionAmountDataMap).length
            ? dayjs().valueOf()
            : dayjs().add(6, 'months').valueOf(),
          files: [
            {
              filename: s3Key.split('/').pop() || 'EDD Review.docx',
              size: body.byteLength,
              s3Key,
            },
          ],
        })

        await this.saveComment(tenantId, job.parameters.caseId, comment, [
          {
            filename: s3Key.split('/').pop() || 'EDD Review.docx',
            size: body.byteLength,
            s3Key,
          },
        ])
      } catch (error) {
        this.executionLogs.push(
          `[${new Date().toISOString()}]: ERROR: Failed to save case comment: ${error}`
        )
        logger.error(error)
      }
    } catch (error) {
      logger.error('Error in EDD review batch job:', error)
      throw error
    }
  }
}
