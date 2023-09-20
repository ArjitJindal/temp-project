import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { questions } from './definitions'
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

export class QuestionService {
  static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) {
    const mongoClient = await getMongoDbClient()
    const { principalId: tenantId } = event.requestContext.authorizer

    return new QuestionService(
      new InvestigationRepository(mongoClient, tenantId)
    )
  }
  private investigationRepository: InvestigationRepository

  constructor(investigationRepository: InvestigationRepository) {
    this.investigationRepository = investigationRepository
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
  ) {
    const question = questions.find((qt) => qt.questionId === questionId)
    if (!question) {
      throw new Error(`Cant resolve question from ${questionId}`)
    }

    const userId =
      c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId
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
    }

    if (!question?.type) {
      throw new Error()
    }

    varObject = { ...question.defaults(ctx), ...varObject }

    const common = {
      questionId,
      variableOptions: Object.entries(question.variableOptions).map(
        ([name, variableType]): QuestionVariableOption => {
          return {
            name,
            variableType,
          }
        }
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
      return {
        ...common,
        rows: await question?.aggregationPipeline(ctx, varObject),
        headers: question.headers.map((c) => ({
          name: c.name,
          columnType: c.columnType,
        })),
      }
    }
    if (question.type === 'STACKED_BARCHART') {
      return {
        ...common,
        series: await question?.aggregationPipeline(ctx, varObject),
      }
    }
    if (question.type === 'TIME_SERIES') {
      return {
        ...common,
        timeseries: await question?.aggregationPipeline(ctx, varObject),
      }
    }
    if (question.type === 'BARCHART') {
      return {
        ...common,
        values: await question?.aggregationPipeline(ctx, varObject),
      }
    }
    throw new Error(`Unsupported question type`)
  }
}
