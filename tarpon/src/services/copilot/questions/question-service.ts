import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { getQueries, getQuestions } from './definitions'
import { InvestigationRepository } from './investigation-repository'
import { InvestigationContext, Variables } from './types'
import { QuestionResponse } from '@/@types/openapi-internal/QuestionResponse'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { getContext } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { QuestionVariable } from '@/@types/openapi-internal/QuestionVariable'
import { QuestionVariableOption } from '@/@types/openapi-internal/QuestionVariableOption'
import { GetQuestionsResponse } from '@/@types/openapi-internal/GetQuestionsResponse'
import { logger } from '@/core/logger'
import { prompt } from '@/utils/openapi'
import { getUserName } from '@/utils/helpers'
import { AccountsService } from '@/services/accounts'
import dayjs from '@/utils/dayjs'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { traceable } from '@/core/xray'

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
      await AccountsService.fromEvent(event)
    )
  }

  private investigationRepository: InvestigationRepository
  private accountsService: AccountsService

  constructor(
    investigationRepository: InvestigationRepository,
    accountService: AccountsService
  ) {
    this.investigationRepository = investigationRepository
    this.accountsService = accountService
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

    const varObject = vars.reduce<Variables>((acc, v) => {
      acc[v.name] = v.value
      return acc
    }, {})

    const answer = await this.answer(questionId, varObject, c, a)
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

  async getQuestions(alert: Alert, c: Case): Promise<GetQuestionsResponse> {
    if (!alert.alertId) {
      throw new Error('No alert ID')
    }
    const investigation = await this.investigationRepository.getInvestigation(
      alert.alertId
    )
    return {
      data: await Promise.all(
        investigation.questions.map(async (q) => {
          return {
            createdById: q.createdById,
            createdAt: q.createdAt,
            ...(await this.answer(q.questionId, q.variables, c, alert)),
          }
        })
      ),
    }
  }

  private async answer(
    questionId: string,
    varObject: Variables,
    c: Case,
    a: Alert
  ): Promise<Omit<QuestionResponse, 'createdAt' | 'createdById'>> {
    const userId =
      c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId
    const user = (c.caseUsers?.destination || c.caseUsers?.origin) as
      | InternalConsumerUser
      | InternalBusinessUser
    const username = getUserName(user)
    const tenantId = getContext()?.tenantId
    const caseId = c.caseId
    const alertId = a.alertId

    if (!tenantId || !userId || !caseId || !alertId || !user) {
      throw new Error('Could not get context for question')
    }
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
    }

    const questions = getQuestions()
    let question = questions.find((qt) => qt.questionId === questionId)
    if (!question) {
      const { questionId: gptQuestionId, variables } = await this.gpt(
        ctx,
        questionId
      )
      varObject = variables
      question = questions.find((qt) => qt.questionId === gptQuestionId)
    }

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
      title: question.title ? await question.title(ctx, varObject) : questionId,
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

  private async gpt(ctx: InvestigationContext, questionPrompt: string) {
    try {
      const response = await prompt([
        {
          role: 'system',
          content: `You are a machine with the following available "questions" with their corresponding "variables": ${JSON.stringify(
            getQueries()
          )}
            You will be asked a to provide a single "questionId" and it's corresponding "variables" based on user input. You will communicate datetimes in the following format ${new Date().toISOString()}. You must reply with valid, iterable RFC8259 compliant JSON in your responses with the following structure as defined in typescript:
{
  questionId: string,
  variables: {
    [key: string]: string | number
  }
}`,
        },
        {
          role: 'system',
          content: `Today's date is ${new Date().toISOString()}.`,
        },
        {
          role: 'assistant',
          content: `Please parse "${questionPrompt}" to give the best matching questionId and variables.`,
        },
      ])
      const result = JSON.parse(response)
      const questions = getQuestions()
      const question = questions.find((q) => q.questionId === result.questionId)

      // Workaround in case GPT sets variable type as the value.
      Object.entries(result.variables).map(([key, value]) => {
        // TODO make an enum type for this.
        if (
          typeof value === 'string' &&
          ['DATE', 'DATETIME', 'STRING', 'INTEGER', 'FLOAT'].indexOf(value) > -1
        ) {
          delete result.variables[key]
        }
      })

      // Workaround for GPT setting from/to dates to the same value
      if (
        result.variables['from'] === result.variables['to'] &&
        typeof result.variables['from'] === 'string' &&
        result.variables['from'].length > 0
      ) {
        result.variables['from'] = dayjs(result.variables['to'] as number)
          .subtract(1, 'day')
          .format('YYYY-MM-DD')
      }

      // Parse datetime variables
      if (question?.variableOptions) {
        Object.entries(question.variableOptions).map(([key, type]) => {
          if (type === 'DATETIME' || type === 'DATE') {
            if (key in result.variables) {
              if (isIsoDate(result.variables[key])) {
                result.variables[key] = new Date(
                  result.variables[key] as number
                ).valueOf()
              } else {
                delete result.variables[key]
              }
            }
          }
        })
      }

      return result
    } catch (e) {
      logger.error(e)
      throw new BadRequest('AI could not understand this query')
    }
  }

  async autocompleteVariable(
    questionId: string,
    variable: string,
    search: string
  ) {
    const tenantId = getContext()?.tenantId

    const variableOption = getQuestions().find(
      (q) => q.questionId === questionId
    )?.variableOptions[variable]
    // TODO make the typing here a bit nicer.
    if (
      tenantId &&
      variableOption &&
      typeof variableOption !== 'string' &&
      variableOption.type === 'SEARCH'
    ) {
      return variableOption.search(tenantId, search)
    }
    return []
  }
}

function isIsoDate(str) {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return false
  const d = new Date(str)
  return d instanceof Date && !isNaN(d.getTime()) && d.toISOString() === str // valid date
}
