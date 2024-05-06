import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { BadRequest } from 'http-errors'
import { StackConstants } from '@lib/constants'
import { getQuestion, getQuestions, isValidQuestion } from './definitions'
import { InvestigationRepository } from './investigation-repository'
import { InvestigationContext, Question, Variables } from './types'
import { QuestionResponse } from '@/@types/openapi-internal/QuestionResponse'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { getContext } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { QuestionVariable } from '@/@types/openapi-internal/QuestionVariable'
import { QuestionVariableOption } from '@/@types/openapi-internal/QuestionVariableOption'
import { GetQuestionsResponse } from '@/@types/openapi-internal/GetQuestionsResponse'
import { getUserName } from '@/utils/helpers'
import { AccountsService } from '@/services/accounts'
import dayjs from '@/utils/dayjs'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { traceable } from '@/core/xray'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { generateChecksum } from '@/utils/object'
import { AutocompleteService } from '@/services/copilot/questions/autocompletion-service'
import { CurrencyService } from '@/services/currency'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

@traceable
export class QuestionService {
  static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) {
    const mongoClient = await getMongoDbClient()
    const { principalId: tenantId } = event.requestContext.authorizer

    return new QuestionService(
      new InvestigationRepository(mongoClient, tenantId),
      await AccountsService.fromEvent(event),
      await getDynamoDbClientByEvent(event)
    )
  }

  private investigationRepository: InvestigationRepository
  private accountsService: AccountsService
  private dynamoClient: DynamoDBDocumentClient

  private autocompleteService: AutocompleteService

  constructor(
    investigationRepository: InvestigationRepository,
    accountService: AccountsService,
    dynamoClient: DynamoDBDocumentClient
  ) {
    this.investigationRepository = investigationRepository
    this.accountsService = accountService
    this.dynamoClient = dynamoClient
    this.autocompleteService = new AutocompleteService()
  }

  async addQuestion(
    createdById: string,
    questionId: string,
    vars: QuestionVariable[],
    c: Case,
    a: Alert
  ): Promise<QuestionResponse> {
    if (!a.alertId) {
      throw new Error('No alert ID')
    }
    const question = getQuestions().find((q) => q.questionId == questionId)
    if (!question) {
      throw new Error('No question')
    }

    const varObject = this.prepareVariables(question, vars)
    const answer = await this.answer(question, varObject, c, a)
    if (answer) {
      const questionResponse = {
        createdAt: Date.now().valueOf(),
        createdById,
        ...answer,
      }
      await this.investigationRepository.addQuestion(
        { createdAt: Date.now().valueOf(), createdById, ...answer },
        a.alertId,
        varObject
      )
      return questionResponse
    }
    throw new Error(`Unsupported question type`)
  }

  async answerQuestionFromString(
    createdById: string,
    questionString: string,
    vars: QuestionVariable[],
    c: Case,
    a: Alert
  ): Promise<GetQuestionsResponse> {
    const question = getQuestions().find(
      (qt) => qt.questionId === questionString
    )
    if (question) {
      const answer = await this.addQuestion(
        createdById,
        questionString,
        vars,
        c,
        a
      )
      return {
        data: [answer],
      }
    }

    const questions = await this.autocompleteService.interpretQuestion(
      questionString
    )
    if (questions.length == 0) {
      throw new BadRequest('AI was unable to understand your question')
    }

    return {
      data: await Promise.all(
        questions.map(async (question) => {
          return await this.addQuestion(
            createdById,
            question.questionId,
            question.variables,
            c,
            a
          )
        })
      ),
    }
  }

  async getQuestions(alert: Alert, c: Case): Promise<GetQuestionsResponse> {
    if (!alert.alertId) {
      throw new Error('No alert ID')
    }
    const investigation = await this.investigationRepository.getInvestigation(
      alert.alertId
    )
    return {
      data: await Promise.all(
        investigation.questions
          .filter((q) => isValidQuestion(q.questionId))
          .map(async (q) => {
            return {
              createdById: q.createdById,
              createdAt: q.createdAt,
              ...(await this.answer(
                getQuestion(q.questionId),
                q.variables,
                c,
                alert
              )),
            }
          })
      ),
    }
  }

  private async answer(
    question: Question<any>,
    varObject: Variables,
    c: Case,
    a: Alert
  ): Promise<Omit<QuestionResponse, 'createdAt' | 'createdById'>> {
    const userId =
      (c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId) ?? ''
    const user = (c.caseUsers?.destination || c.caseUsers?.origin) as
      | InternalConsumerUser
      | InternalBusinessUser
    const paymentIdentifier =
      c.paymentDetails?.origin || c.paymentDetails?.destination
    const username = getUserName(user)
    const tenantId = getContext()?.tenantId
    const caseId = c.caseId
    const alertId = a.alertId

    if (
      !tenantId ||
      !caseId ||
      !alertId ||
      (!userId && !user && !paymentIdentifier)
    ) {
      throw new Error('Could not get context for question')
    }

    // Preloading currency data so we don't have to make all the questions async.
    const cs = new CurrencyService()
    const exchangeData = await cs.getExchangeData()
    const convert = (amount: number, target: CurrencyCode) =>
      amount * exchangeData.rates[target]

    const ctx: InvestigationContext = {
      alert: a,
      _case: c,
      user,
      tenantId,
      userId,
      caseId,
      alertId,
      username,
      accountService: this.accountsService,
      convert,
      paymentIdentifier,
      humanReadableId: username ?? 'payment details',
    }

    const partitionKeyId = DynamoDbKeys.CACHE_QUESTION_RESULT(
      tenantId,
      alertId,
      question.questionId,
      generateChecksum(varObject),
      question.version
    )
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: partitionKeyId,
    }
    const result = await this.dynamoClient.send(new GetCommand(getItemInput))
    if (result.Item) {
      return result.Item.response as QuestionResponse
    }

    const response = await this.getQuestionResponse(ctx, varObject, question)
    void this.dynamoClient.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Item: {
          ...partitionKeyId,
          ttl:
            question.type === 'TABLE'
              ? undefined
              : Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Cache for a day
          response,
        },
      })
    )
    return response
  }

  private async getQuestionResponse(
    ctx: InvestigationContext,
    varObject: Variables,
    question: Question<Variables>
  ) {
    if (!question?.type) {
      throw new Error()
    }

    varObject = { ...question.defaults(ctx), ...varObject }

    const common = {
      questionId: question.questionId,
      variableOptions: await Promise.all(
        Object.entries(question.variableOptions).map(
          async ([name, variableType]): Promise<QuestionVariableOption> => {
            if (typeof variableType === 'string') {
              return {
                name,
                variableType,
              }
            }

            return {
              name,
              variableType: variableType.type,
              options:
                variableType.type === 'AUTOCOMPLETE'
                  ? variableType.options && (await variableType.options(ctx))
                  : undefined,
            }
          }
        )
      ),
      questionType: question.type,
      title: question.title
        ? await question.title(ctx, varObject)
        : question.questionId,
      explainer: question.explainer,
      variables: Object.entries(varObject).map(([name, value]) => {
        return {
          name,
          value,
        }
      }),
    }

    if (question.type === 'TABLE') {
      const result = await question.aggregationPipeline(ctx, varObject)
      return {
        ...common,
        total: result.data.total,
        rows: result.data.items,
        summary: result.summary,
        headers: question.headers.map((c) => ({
          name: c.name,
          columnType: c.columnType,
        })),
      }
    }
    if (question.type === 'STACKED_BARCHART') {
      const result = await question.aggregationPipeline(ctx, varObject)
      return {
        ...common,
        summary: result.summary,
        series: result.data,
      }
    }
    if (question.type === 'TIME_SERIES') {
      const result = await question.aggregationPipeline(ctx, varObject)
      return {
        ...common,
        summary: result.summary,
        timeseries: result.data,
      }
    }
    if (question.type === 'PROPERTIES') {
      const result = await question.aggregationPipeline(ctx, varObject)
      return {
        ...common,
        summary: result.summary,
        properties: result.data,
      }
    }
    if (question.type === 'BARCHART') {
      const result = await question.aggregationPipeline(ctx, varObject)
      return {
        ...common,
        values: result.data,
        summary: result.summary,
      }
    }
    if (question.type === 'EMBEDDED') {
      return common
    }

    throw new Error(`Unsupported question type`)
  }

  private prepareVariables(question: Question<any>, vars: Variables) {
    const varObject = vars.reduce((acc, v) => {
      if (v.value) {
        acc[v.name] = v.value
      }
      return acc
    }, {})

    // Workaround in case GPT sets variable type as the value.
    Object.entries(varObject).map(([key, value]) => {
      // TODO make an enum type for this.
      if (
        typeof value === 'string' &&
        ['DATE', 'DATETIME', 'STRING', 'INTEGER', 'FLOAT'].indexOf(value) > -1
      ) {
        delete varObject[key]
      }
    })

    // Workaround for GPT setting from/to dates to the same value
    if (
      varObject['from'] === varObject['to'] &&
      typeof varObject['from'] === 'string' &&
      varObject['from'].length > 0
    ) {
      varObject['from'] = dayjs(varObject['to'] as number)
        .subtract(1, 'day')
        .format('YYYY-MM-DD')
    }

    // Parse datetime variables
    if (question?.variableOptions) {
      Object.entries(question.variableOptions).map(([key, type]) => {
        if (type === 'DATETIME' || type === 'DATE') {
          if (key in varObject) {
            if (isIsoDate(varObject[key])) {
              varObject[key] = new Date(varObject[key] as string).valueOf()
            } else if (typeof varObject[key] !== 'number') {
              delete varObject[key]
            }
          }
        }
      })
    }
    return varObject
  }
}

function isIsoDate(str) {
  if (
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str) ||
    /\d{4}-\d{2}-\d{2}/.test(str)
  ) {
    const d = new Date(str)
    return d instanceof Date && !isNaN(d.getTime())
  }
  return false
}
