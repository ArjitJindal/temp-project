import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { queries, questions } from './definitions'
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
import { ask } from '@/utils/openapi'
import { getUserName } from '@/utils/helpers'
import { AccountsService } from '@/services/accounts'

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
    let question = questions.find((qt) => qt.questionId === questionId)
    if (!question) {
      const { questionId: gptQuestionId, variables } = await this.gpt(
        questionId
      )
      varObject = variables
      question = questions.find((qt) => qt.questionId === gptQuestionId)
    }

    const userId =
      c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId
    const user = c.caseUsers?.destination || c.caseUsers?.origin
    const username = getUserName(user)
    const tenantId = getContext()?.tenantId
    const caseId = c.caseId
    const alertId = a.alertId

    if (!tenantId || !userId || !caseId || !alertId) {
      throw new Error('Could not get context for question')
    }
    const ctx: InvestigationContext = {
      alert: a,
      _case: c,
      tenantId,
      userId,
      caseId,
      alertId,
      username,
      getAccounts: this.accountsService.getAccounts,
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
                variableType.options && (await variableType.options(ctx)),
            }
          }
        )
      ),
      questionType: question.type,
      title: question.title ? question.title(ctx, varObject) : questionId,
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
        rows: result.data,
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
    if (question.type === 'BARCHART') {
      const result = await question.aggregationPipeline(ctx, varObject)
      return {
        ...common,
        summary: result.summary,
        values: result.data,
      }
    }
    throw new Error(`Unsupported question type`)
  }

  private async gpt(question: string): Promise<{
    questionId: string
    variables: Variables
  }> {
    const prompt = `
    ${JSON.stringify(queries)}
Please parse "${question}" to give the best matching query and variables values that should be set. The only output you will provide will be in the following format, defined in typescript, with no extra context or content. Dates and datetimes should be output in ISO format, for example the datetime now is ${new Date().toISOString()} and the date is ${new Date()
      .toISOString()
      .substring(0, 10)}:
{
  questionId: string,
  variables: {
    [key: string]: string | number
  }
}`

    try {
      return JSON.parse(await ask(prompt))
    } catch (e) {
      logger.error(e)
      throw new Error('AI could not understand this query')
    }
  }
}
