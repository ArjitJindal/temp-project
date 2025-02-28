import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { AutoNarrativeService } from '@/services/copilot/auto-narrative-service'
import { CaseService } from '@/services/cases'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { QuestionService } from '@/services/copilot/questions/question-service'
import { AlertsService } from '@/services/alerts'
import { AutocompleteService } from '@/services/copilot/questions/autocompletion-service'
import { AI_SOURCES } from '@/services/copilot/attributes/ai-sources'
import { RetrievalService } from '@/services/copilot/retrieval-service'

export const copilotHandler = lambdaApi({})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const [caseService, alertsService] = await Promise.all([
      CaseService.fromEvent(event),
      AlertsService.fromEvent(event),
    ])

    const handlers = new Handlers()

    const copilotService = new AutoNarrativeService()
    const retrievalService = await RetrievalService.new(event)

    handlers.registerGenerateNarrative(async (ctx, request) => {
      const {
        entityId,
        entityType,
        reasons,
        otherReason,
        additionalCopilotInfo,
        narrativeMode,
      } = request.NarrativeRequest

      const attributes = await retrievalService.getAttributes(
        entityId,
        entityType,
        reasons,
        additionalCopilotInfo
      )

      return copilotService.getNarrative(
        entityType,
        attributes,
        additionalCopilotInfo ?? {},
        narrativeMode,
        otherReason
      )
    })

    handlers.registerFormatNarrative(async (_ctx, request) => {
      const { entityId, entityType, narrative, reasons } =
        request.NarrativeRequest

      return copilotService.formatNarrative(
        narrative,
        await retrievalService.getAttributes(entityId, entityType, reasons)
      )
    })

    handlers.registerGetQuestions(async (_ctx, request) => {
      const questionService = await QuestionService.fromEvent(event)
      const response = await alertsService.getAlert(request.alertId)
      const alert = response.result
      if (!alert?.caseId) {
        throw new Error(`Alert ${alert?.alertId} has no case ID`)
      }

      const cresponse = await caseService.getCase(alert.caseId)
      const c = cresponse.result
      return await questionService.getQuestions(alert, c)
    })

    const questionService = await QuestionService.fromEvent(event)
    handlers.registerPostQuestion(async (ctx, request) => {
      const caseService = await CaseService.fromEvent(event)
      const alertService = await AlertsService.fromEvent(event)
      const response = await alertService.getAlert(request.alertId)
      const alert = response.result
      if (!alert?.caseId) {
        throw new Error(`Alert ${alert?.alertId} has no case ID`)
      }
      const cresponse = await caseService.getCase(alert.caseId)
      const c = cresponse.result
      return questionService.answerQuestionFromString(
        ctx.userId,
        request.QuestionRequest.question || '',
        request.QuestionRequest.variables || [],
        c,
        alert
      )
    })

    handlers.registerGetQuestionVariableAutocomplete(async (ctx, request) => {
      const autocomplete = new AutocompleteService()
      return {
        suggestions: await autocomplete.autocompleteVariable(
          request.questionId,
          request.variableKey,
          request.search
        ),
      }
    })

    handlers.registerGetQuestionAutocomplete(async (ctx, request) => {
      const autocomplete = new AutocompleteService()
      const c = await caseService.getCaseByAlertId(request.alertId)
      const alert = c?.alerts?.find((a) => a.alertId === request.alertId)
      const suggestions = autocomplete.autocomplete(request.question || '', c)

      if (alert?.ruleNature === 'SCREENING') {
        return { suggestions }
      }

      return {
        suggestions: suggestions.filter(
          (s) =>
            !COPILOT_QUESTIONS.CLEARED_HITS.includes(s) &&
            !COPILOT_QUESTIONS.OPEN_HITS.includes(s)
        ),
      }
    })

    handlers.registerGetAiSources(async () => {
      return {
        aiSources: AI_SOURCES,
      }
    })

    return await handlers.handle(event)
  }
)
