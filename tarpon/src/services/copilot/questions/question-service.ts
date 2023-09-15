import { questions } from './definitions'
import { QuestionResponse } from '@/@types/openapi-internal/QuestionResponse'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { getContext } from '@/core/utils/context'
import { Variables } from '@/@types/openapi-internal/Variables'

export class QuestionService {
  async answer(
    questionId: string,
    vars: Variables[],
    c: Case,
    a: Alert
  ): Promise<QuestionResponse> {
    let varObject = vars.reduce<{ [key: string]: string | number }>(
      (acc, v) => {
        acc[v.name] = v.value
        return acc
      },
      {}
    )
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

    if (!question?.type) {
      throw new Error()
    }

    varObject = question.defaults
      ? { ...varObject, ...question.defaults() }
      : varObject

    const common = {
      questionId,
      questionType: question.type,
      title: question.title ? question.title(varObject) : questionId,
    }

    if (question.type === 'TABLE') {
      return {
        ...common,
        rows: await question?.aggregationPipeline(
          { tenantId, userId, caseId, alertId },
          varObject
        ),
        headers: question.headers.map((c) => ({
          name: c.name,
          columnType: c.columnType,
        })),
      }
    }
    if (question.type === 'STACKED_BARCHART') {
      return {
        ...common,
        series: await question?.aggregationPipeline(
          { tenantId, userId, caseId, alertId },
          varObject
        ),
      }
    }
    if (question.type === 'TIME_SERIES') {
      return {
        ...common,
        timeseries: await question?.aggregationPipeline(
          { tenantId, userId, caseId, alertId },
          varObject
        ),
      }
    }
    if (question.type === 'BARCHART') {
      return {
        ...common,
        values: await question?.aggregationPipeline(
          { tenantId, userId, caseId, alertId },
          varObject
        ),
      }
    }
    throw new Error(`Unsupported question type`)
  }
}
