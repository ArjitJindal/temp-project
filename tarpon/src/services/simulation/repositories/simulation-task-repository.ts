import { Filter, MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { memoize, omit, random } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { demoRuleSimulation } from '../utils/demo-rule-simulation'
import { demoRiskFactorsSimulation } from '../utils/demo-risk-factors-simulation'
import { demoRiskFactorsV8Simulation } from '../utils/demo-risk-factors-v8-simulation'
import { SimulationResultRepository } from './simulation-result-repository'
import { paginatePipeline } from '@/utils/mongodb-utils'
import { SIMULATION_TASK_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationRiskLevelsJob } from '@/@types/openapi-internal/SimulationRiskLevelsJob'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SimulationRiskLevelsStatisticsResult } from '@/@types/openapi-internal/SimulationRiskLevelsStatisticsResult'
import { SimulationBeaconStatisticsResult } from '@/@types/openapi-internal/SimulationBeaconStatisticsResult'
import { SimulationRiskLevelsParametersRequest } from '@/@types/openapi-internal/SimulationRiskLevelsParametersRequest'
import { SimulationRiskLevelsIteration } from '@/@types/openapi-internal/SimulationRiskLevelsIteration'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { SimulationGetResponse } from '@/@types/openapi-internal/SimulationGetResponse'
import { SimulationPostResponse } from '@/@types/openapi-internal/SimulationPostResponse'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'
import { SimulationBeaconParametersRequest } from '@/@types/openapi-internal/SimulationBeaconParametersRequest'
import { SimulationBeaconIteration } from '@/@types/openapi-internal/SimulationBeaconIteration'
import { SimulationJob } from '@/@types/openapi-internal/SimulationJob'
import { isCurrentUserAtLeastRole } from '@/@types/jwt'
import { traceable } from '@/core/xray'
import { isDemoTenant } from '@/utils/tenant'
import { TXN_COUNT } from '@/core/seed/data/transactions'
import { SimulationRiskFactorsStatisticsResult } from '@/@types/openapi-internal/SimulationRiskFactorsStatisticsResult'
import { SimulationRiskFactorsParametersRequest } from '@/@types/openapi-internal/SimulationRiskFactorsParametersRequest'
import { SimulationRiskFactorsJob } from '@/@types/openapi-internal/SimulationRiskFactorsJob'
import { SimulationRiskFactorsIteration } from '@/@types/openapi-internal/SimulationRiskFactorsIteration'
import { SimulationV8RiskFactorsJob } from '@/@types/openapi-internal/SimulationV8RiskFactorsJob'
import { SimulationV8RiskFactorsIteration } from '@/@types/openapi-internal/SimulationV8RiskFactorsIteration'
import { SimulationV8RiskFactorsStatisticsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsStatisticsResult'
import { SimulationV8RiskFactorsParametersRequest } from '@/@types/openapi-internal/SimulationV8RiskFactorsParametersRequest'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'
import { getUserName } from '@/utils/helpers'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { SimulationBeaconTransactionResult } from '@/@types/openapi-internal/SimulationBeaconTransactionResult'
import { SimulationBeaconResultUser } from '@/@types/openapi-internal/SimulationBeaconResultUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

type SimulationRequest =
  | SimulationRiskLevelsParametersRequest
  | SimulationBeaconParametersRequest
  | SimulationRiskFactorsParametersRequest
  | SimulationV8RiskFactorsParametersRequest

type SimulationIteration =
  | SimulationRiskLevelsIteration
  | SimulationBeaconIteration
  | SimulationRiskFactorsIteration
  | SimulationV8RiskFactorsIteration

type SimulationAllJobs =
  | SimulationRiskLevelsJob
  | SimulationBeaconJob
  | SimulationRiskFactorsJob
  | SimulationV8RiskFactorsJob

type SimulationStatisticsResult =
  | SimulationRiskLevelsStatisticsResult
  | SimulationBeaconStatisticsResult
  | SimulationRiskFactorsStatisticsResult
  | SimulationV8RiskFactorsStatisticsResult

@traceable
export class SimulationTaskRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  private generateIterationsObject(
    simulationRequest: SimulationRequest,
    taskIds: string[]
  ): SimulationIteration[] {
    const now = Date.now()
    const status: TaskStatusChange = {
      status: 'PENDING',
      timestamp: now,
    }

    const result = simulationRequest.parameters.map((parameter) => {
      const taskId = uuidv4()
      taskIds.push(taskId)

      let statistics: SimulationStatisticsResult | undefined = undefined

      if (simulationRequest.type === 'PULSE') {
        statistics = {
          current: [],
          simulated: [],
        }
      } else if (simulationRequest.type === 'BEACON') {
        statistics = {
          current: {},
          simulated: {},
        }
      } else if (
        simulationRequest.type === 'RISK_FACTORS' ||
        simulationRequest.type === 'RISK_FACTORS_V8'
      ) {
        statistics = {
          current: {},
          simulated: {},
        }
      }
      return {
        taskId,
        parameters: parameter,
        progress: 0,
        statistics,
        latestStatus: status,
        statuses: [status],
        name: parameter.name,
        description: parameter.description,
        type: parameter.type,
        createdAt: now,
        createdBy:
          process.env.NODE_ENV === 'test'
            ? 'test'
            : (getContext()?.user as Account)?.id,
      }
    })

    return simulationRequest.type === 'PULSE'
      ? (result as SimulationRiskLevelsIteration[])
      : simulationRequest.type === 'BEACON'
      ? (result as SimulationBeaconIteration[])
      : simulationRequest.type === 'RISK_FACTORS_V8'
      ? (result as SimulationV8RiskFactorsIteration[])
      : (result as SimulationRiskFactorsIteration[])
  }

  public async createSimulationJob(
    simulationRequest: SimulationRequest
  ): Promise<SimulationPostResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )

    const taskIds: string[] = []
    const now = Date.now()
    const jobId = simulationRequest.jobId ?? uuidv4()

    if (simulationRequest.jobId) {
      const existsingJob = await collection.findOne({
        _id: simulationRequest.jobId as any,
      })

      const newIterations: SimulationIteration[] = (
        existsingJob?.iterations ?? []
      ).concat(this.generateIterationsObject(simulationRequest, taskIds))

      await collection.updateOne(
        { _id: simulationRequest.jobId as any },
        {
          $set: {
            iterations: newIterations as SimulationRiskLevelsIteration[],
          },
        }
      )
    } else {
      const createdByUser = getContext()?.user as Account
      const baseJob: SimulationJob = {
        createdAt: now,
        jobId,
        createdBy: process.env.NODE_ENV === 'test' ? 'test' : createdByUser?.id,
        internal: isCurrentUserAtLeastRole('root'),
      }
      let job: SimulationAllJobs | null = null

      if (simulationRequest.type === 'PULSE') {
        job = {
          ...baseJob,
          type: 'PULSE',
          defaultRiskClassifications:
            simulationRequest.defaultRiskClassifications,
          iterations: this.generateIterationsObject(simulationRequest, taskIds),
        } as SimulationRiskLevelsJob
      } else if (simulationRequest.type === 'BEACON') {
        job = {
          ...baseJob,
          type: 'BEACON',
          defaultRuleInstance: simulationRequest.defaultRuleInstance,
          iterations: this.generateIterationsObject(simulationRequest, taskIds),
        } as SimulationBeaconJob
      } else if (simulationRequest.type === 'RISK_FACTORS_V8') {
        job = {
          ...baseJob,
          type: 'RISK_FACTORS_V8',
          iterations: this.generateIterationsObject(simulationRequest, taskIds),
        } as SimulationV8RiskFactorsJob
      } else {
        job = {
          ...baseJob,
          type: 'RISK_FACTORS',
          iterations: this.generateIterationsObject(simulationRequest, taskIds),
        } as SimulationRiskFactorsJob
      }

      if (isDemoTenant(this.tenantId)) {
        if (simulationRequest.type === 'BEACON') {
          return this.createBeaconSimulationJob(
            jobId,
            taskIds,
            simulationRequest as SimulationBeaconParametersRequest
          )
        } else if (simulationRequest.type === 'RISK_FACTORS_V8') {
          return this.createRiskFactorsV8SimulationJob(
            jobId,
            taskIds,
            simulationRequest as SimulationV8RiskFactorsParametersRequest
          )
        } else if (simulationRequest.type === 'RISK_FACTORS') {
          return this.createRiskFactorsSimulationJob(
            jobId,
            taskIds,
            simulationRequest as SimulationRiskFactorsParametersRequest
          )
        }
      }

      await collection.insertOne({
        _id: job.jobId as any,
        ...job,
      })
    }

    return { jobId, taskIds }
  }

  private async getUserResults(taskIds: string[]) {
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb,
    })
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const users = userRepository.getUsersCursor(
      {},
      {
        userId: 1,
        type: 1,
        userDetails: { name: 1 },
        legalEntity: { companyGeneralDetails: { legalName: 1 } },
        krsScore: 1,
        drsScore: 1,
      }
    )
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const usersData = await users.toArray()

    const usersResult: SimulationV8RiskFactorsResult[] = usersData.map(
      (user) => {
        const randomKrsScore = random(1, 100)
        const randomDrsScore = random(1, 100)

        const simulatedKrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          randomKrsScore
        )
        const simulatedDrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          randomDrsScore
        )

        const currentKrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          user.krsScore?.krsScore ?? 0
        )
        const currentDrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          user.drsScore?.drsScore ?? 0
        )
        return {
          taskId: taskIds[0],
          type: 'RISK_FACTORS_V8',
          userId: user.userId,
          userType: user.type,
          userName: getUserName(user),
          current: {
            krs: { riskLevel: currentKrsRiskLevel, riskScore: randomKrsScore },
            drs: { riskLevel: currentDrsRiskLevel, riskScore: randomDrsScore },
          },
          simulated: {
            krs: {
              riskLevel: simulatedKrsRiskLevel,
              riskScore: randomKrsScore,
            },
            drs: {
              riskLevel: simulatedDrsRiskLevel,
              riskScore: randomDrsScore,
            },
          },
        }
      }
    )

    return usersResult
  }

  private getStats(
    usersResult: SimulationV8RiskFactorsResult[]
  ):
    | SimulationV8RiskFactorsStatisticsResult
    | SimulationRiskFactorsStatisticsResult {
    return {
      current: RISK_LEVELS.flatMap((riskLevel) => {
        return [
          {
            count: usersResult.filter(
              (user) => user.current?.krs?.riskLevel === riskLevel
            ).length,
            riskLevel,
            riskType: 'KRS',
          },
          {
            count: usersResult.filter(
              (user) => user.current?.drs?.riskLevel === riskLevel
            ).length,
            riskLevel,
            riskType: 'DRS',
          },
          {
            count: random(1, 1000),
            riskLevel,
            riskType: 'ARS',
          },
        ]
      }),
      simulated: RISK_LEVELS.flatMap((riskLevel) => {
        return [
          {
            count: usersResult.filter(
              (user) => user.simulated?.krs?.riskLevel === riskLevel
            ).length,
            riskLevel,
            riskType: 'KRS',
          },
          {
            count: usersResult.filter(
              (user) => user.simulated?.drs?.riskLevel === riskLevel
            ).length,
            riskLevel,
            riskType: 'DRS',
          },
          {
            count: random(1, 1000),
            riskLevel,
            riskType: 'ARS',
          },
        ]
      }),
    }
  }

  private async createRiskFactorsSimulationJob(
    jobId: string,
    taskIds: string[],
    simulationRequest: SimulationRiskFactorsParametersRequest
  ) {
    const now = Date.now()
    const demoJob: SimulationRiskFactorsJob = demoRiskFactorsSimulation
    const createdByUser = getContext()?.user as Account
    demoJob.jobId = jobId
    demoJob.createdAt = now
    demoJob.createdBy = createdByUser?.id
    demoJob.internal = isCurrentUserAtLeastRole('root')
    const usersResult = await this.getUserResults(taskIds)

    demoJob.iterations = simulationRequest.parameters.map(
      (parameter, index) => {
        const parameters: SimulationRiskFactorsIteration['parameters'] = {
          type: 'RISK_FACTORS',
          parameterAttributeRiskValues: parameter.parameterAttributeRiskValues,
          description: parameter.description ?? '',
          name: parameter.name,
        }
        const iteration: SimulationRiskFactorsIteration = {
          ...demoJob.iterations[0],
          taskId: taskIds[index],
          type: 'RISK_FACTORS',
          name: parameter.name,
          description: parameter.description,
          parameters,
          statistics: this.getStats(
            usersResult
          ) as SimulationRiskFactorsStatisticsResult,
          latestStatus: demoJob.iterations[0].latestStatus as TaskStatusChange,
          progress: demoJob.iterations[0].progress,
          statuses: demoJob.iterations[0].statuses as TaskStatusChange[],
          createdAt: now,
          totalEntities: usersResult.length,
        }

        return iteration
      }
    )

    const simulationResultRepository = new SimulationResultRepository(
      this.tenantId,
      this.mongoDb
    )

    await simulationResultRepository.saveSimulationResults(usersResult)

    return { jobId: demoJob.jobId, taskIds }
  }

  private async createRiskFactorsV8SimulationJob(
    jobId: string,
    taskIds: string[],
    simulationRequest: SimulationV8RiskFactorsParametersRequest
  ) {
    const now = Date.now()
    const demoJob = demoRiskFactorsV8Simulation
    const createdByUser = getContext()?.user as Account
    demoJob.jobId = jobId
    demoJob.createdAt = now
    demoJob.createdBy = createdByUser?.id
    demoJob.internal = isCurrentUserAtLeastRole('root')

    const simulationResultRepository = new SimulationResultRepository(
      this.tenantId,
      this.mongoDb
    )

    const usersResult = await this.getUserResults(taskIds)

    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )

    demoJob.iterations = simulationRequest.parameters.map(
      (parameter, index) => {
        const iteration: SimulationV8RiskFactorsIteration = {
          ...demoJob.iterations[0],
          taskId: taskIds[index],
          type: 'RISK_FACTORS_V8',
          name: parameter.name,
          description: parameter.description,
          parameters: {
            type: 'RISK_FACTORS_V8',
            description: parameter.description ?? '',
            name: parameter.name,
            parameters: parameter.parameters,
            jobId: jobId,
          },
          statistics: this.getStats(usersResult),
          latestStatus: demoJob.iterations[0].latestStatus,
          progress: demoJob.iterations[0].progress,
          statuses: demoJob.iterations[0].statuses,
        }

        return iteration
      }
    )

    await collection.insertOne({
      _id: demoJob.jobId as any,
      ...demoJob,
    })

    await simulationResultRepository.saveSimulationResults(usersResult)

    return { jobId: demoJob.jobId, taskIds }
  }

  private user = memoize((userId: string) => {
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    return userRepository.getMongoUser(userId, undefined, {
      projection: {
        userId: 1,
        type: 1,
        userDetails: { name: 1 },
        legalEntity: { companyGeneralDetails: { legalName: 1 } },
        drsScore: 1,
      },
    })
  })

  private async createBeaconSimulationJob(
    jobId: string,
    taskIds: string[],
    simulationRequest: SimulationBeaconParametersRequest
  ) {
    const now = Date.now()
    const demoJob = demoRuleSimulation
    const createdByUser = getContext()?.user as Account
    demoJob.jobId = jobId
    demoJob.createdAt = now
    demoJob.createdBy = createdByUser?.id
    demoJob.internal = isCurrentUserAtLeastRole('root')

    demoJob.defaultRuleInstance = simulationRequest.defaultRuleInstance

    demoJob.iterations = simulationRequest.parameters.map(
      (parameter, index) => {
        return {
          ...demoJob.iterations[0],
          taskId: taskIds[index],
          type: 'BEACON',
          name: parameter.name,
          description: parameter.description,
          parameters: {
            ruleInstance: parameter.ruleInstance,
            sampling: {
              transactionsCount: TXN_COUNT,
            },
            name: parameter.name,
            description: parameter.description,
            type: parameter.type,
          },
          statistics: {
            current: {
              falsePositivesCases: random(1, 10),
              totalCases: 11,
              transactionsHit: 100,
              usersHit: 11,
            },
            simulated: {
              falsePositivesCases: random(1, 10),
              totalCases: 22,
              transactionsHit: 200,
              usersHit: 22,
            },
          },
        } as SimulationBeaconIteration
      }
    )

    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )

    await collection.insertOne({
      _id: demoJob.jobId as any,
      ...demoJob,
    })

    const dynamoDb = getDynamoDbClient()
    const mongoTransactionsRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb,
      dynamoDb
    )

    const transactions = mongoTransactionsRepository.getTransactionsCursor({
      pageSize: 10000,
    })
    const riskRepository = new RiskRepository(this.tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const transactionsData: SimulationBeaconTransactionResult[] = []
    const users = new Map<string, SimulationBeaconResultUser>()

    for await (const transaction of transactions) {
      const [destinationUser, originUser] = await Promise.all([
        transaction.destinationUserId
          ? this.user(transaction.destinationUserId)
          : Promise.resolve(undefined),
        transaction.originUserId
          ? this.user(transaction.originUserId)
          : Promise.resolve(undefined),
      ])

      const originMethod = transaction.originPaymentDetails?.method
      const destinationMethod = transaction.destinationPaymentDetails?.method
      const isTransactionHit = Math.random() > 0.5
      const taskId = taskIds[0]
      const data: SimulationBeaconTransactionResult = {
        transactionId: transaction.transactionId,
        action: transaction.status,
        hit: isTransactionHit ? 'HIT' : 'NO_HIT',
        taskId,
        type: 'BEACON_TRANSACTION',
        timestamp: transaction.timestamp,
        destinationAmountDetails: transaction.destinationAmountDetails,
        originAmountDetails: transaction.originAmountDetails,
        ...(destinationMethod
          ? {
              destinationPaymentDetails: {
                paymentMethod: destinationMethod,
                paymentMethodId: transaction.destinationPaymentMethodId ?? '',
              },
            }
          : {}),
        ...(originMethod
          ? {
              originPaymentDetails: {
                paymentMethod: originMethod,
                paymentMethodId: transaction.originPaymentMethodId ?? '',
              },
            }
          : {}),
        ...(destinationUser
          ? {
              destinationUser: {
                userId: destinationUser.userId,
                userName: getUserName(destinationUser),
                userType: destinationUser.type,
                riskLevel: getRiskLevelFromScore(
                  riskClassificationValues,
                  destinationUser.drsScore?.drsScore ?? null
                ),
                riskScore: destinationUser.drsScore?.drsScore,
              },
            }
          : {}),
        ...(originUser
          ? {
              originUser: {
                userId: originUser.userId,
                userName: getUserName(originUser),
                userType: originUser.type,
                riskLevel: getRiskLevelFromScore(
                  riskClassificationValues,
                  originUser.drsScore?.drsScore ?? null
                ),
                riskScore: originUser.drsScore?.drsScore,
              },
            }
          : {}),
        riskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          transaction.arsScore?.arsScore ?? null
        ),
        transactionType: transaction.type,
        riskScore: transaction.arsScore?.arsScore,
      }

      transactionsData.push(data)

      const processUser = (
        user: InternalConsumerUser | InternalBusinessUser | undefined
      ) => {
        if (!user) {
          return
        }
        const userId = user.userId
        if (!users.has(userId)) {
          users.set(userId, {
            userId,
            riskLevel: getRiskLevelFromScore(
              riskClassificationValues,
              user.drsScore?.drsScore ?? null
            ),
            riskScore: user.drsScore?.drsScore,
            hit: isTransactionHit ? 'HIT' : 'NO_HIT',
            taskId,
            type: 'BEACON_USER',
            userName: getUserName(user),
            userType: user.type,
          })
        }
      }

      if (destinationUser) {
        processUser(destinationUser)
      }
      if (originUser) {
        processUser(originUser)
      }
    }

    const simulationResultRepository = new SimulationResultRepository(
      this.tenantId,
      this.mongoDb
    )

    await Promise.all([
      simulationResultRepository.saveSimulationResults(transactionsData),
      simulationResultRepository.saveSimulationResults(
        Array.from(users.values())
      ),
    ])

    return { jobId: demoJob.jobId, taskIds }
  }

  public async updateStatistics<T extends SimulationStatisticsResult>(
    taskId: string,
    statistics: T
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      { 'iterations.taskId': taskId },
      {
        $set: {
          'iterations.$.statistics': statistics,
        },
      }
    )
  }

  public async updateTaskStatus(
    taskId: string,
    status: TaskStatusChangeStatusEnum,
    progress?: number,
    totalEntities?: number
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const newStatus: TaskStatusChange = {
      status,
      timestamp: Date.now(),
    }
    const updateTotalEntities = totalEntities
      ? { 'iterations.$.totalEntities': totalEntities }
      : {}
    const progressToSave = progress
      ? progress
      : status === 'SUCCESS'
      ? 1
      : undefined

    await collection.updateOne(
      { 'iterations.taskId': taskId },
      {
        $set: {
          'iterations.$.latestStatus': newStatus,
          ...(progressToSave
            ? { 'iterations.$.progress': progressToSave }
            : {}),
          ...updateTotalEntities,
        },
        $push: {
          'iterations.$.statuses': newStatus,
        },
      }
    )
  }

  public async getSimulationJob<T extends SimulationAllJobs>(
    jobId: string
  ): Promise<T | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<T>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const task = await collection.findOne({ _id: jobId as any })
    if (!task) {
      return null
    }
    return omit(task, '_id') as unknown as T
  }

  public async getSimulationJobs(
    params: DefaultApiGetSimulationsRequest
  ): Promise<SimulationGetResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const query: Filter<Partial<SimulationAllJobs>> = {
      type: params.type,
    }
    if (!params.includeInternal) {
      query.internal = {
        $ne: true,
      }
    }
    const simulationTasks = await collection
      .aggregate<SimulationAllJobs>([
        { $match: query },
        ...(params.sortField === 'iterations_count'
          ? [
              {
                $addFields: {
                  iterations_count: { $size: { $ifNull: ['$iterations', []] } },
                },
              },
            ]
          : []),
        {
          $sort: {
            [params.sortField ?? 'createdAt']:
              params.sortOrder === 'ascend' ? 1 : -1,
          },
        },
        ...paginatePipeline(params),
        {
          $project: {
            iterations_count: 0,
          },
        },
      ])
      .toArray()

    const total = await collection.countDocuments(query)

    return {
      total,
      data:
        params.type === 'PULSE'
          ? (simulationTasks.map((task) =>
              omit(task, '_id')
            ) as SimulationRiskLevelsJob[])
          : (simulationTasks.map((task) =>
              omit(task, '_id')
            ) as SimulationBeaconJob[]),
    }
  }

  public async getSimulationJobsCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationAllJobs>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    return collection.countDocuments({ internal: { $ne: true } })
  }
}
