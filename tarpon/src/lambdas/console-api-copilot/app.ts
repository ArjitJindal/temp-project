import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CopilotService } from '@/services/copilot/copilot-service'
import { CaseService } from '@/services/cases'
import { UserService } from '@/services/users'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ReportService } from '@/services/sar/service'
import { QuestionService } from '@/services/copilot/questions/question-service'
import { AlertsService } from '@/services/alerts'
import { AutocompleteService } from '@/services/copilot/questions/autocompletion-service'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { AI_SOURCES } from '@/services/copilot/attributes/ai-sources'
import { Case } from '@/@types/openapi-internal/Case'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

export const copilotHandler = lambdaApi({})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const [caseService, alertsService, userService, txnRepository] =
      await Promise.all([
        CaseService.fromEvent(event),
        AlertsService.fromEvent(event),
        UserService.fromEvent(event),
        MongoDbTransactionRepository.fromEvent(event),
      ])

    const handlers = new Handlers()

    handlers.registerGenerateNarrative(async (ctx, request) => {
      const copilotService = await CopilotService.new(event)
      const { entityId, entityType, reasons } = request.NarrativeRequest

      if (entityType === 'REPORT') {
        const reportService = await ReportService.fromEvent(event)

        const report = await reportService.getReport(entityId)
        const _case = await caseService.getCase(report.caseId)

        const userId =
          _case.caseUsers?.origin?.userId ||
          _case.caseUsers?.destination?.userId
        if (!userId) {
          throw new NotFound('No user for found for report')
        }

        const user = await userService.getUser(userId)

        // Hydrate case transactions
        const transactions = await txnRepository.getTransactionsByIds(
          report.parameters.transactions?.map((t) => t.id) ||
            _case.caseTransactionsIds ||
            []
        )
        return copilotService.getSarNarrative({
          _case,
          user,
          reasons,
          transactions,
        })
      }

      const _case =
        entityType === 'CASE'
          ? ((await caseService.getCase(entityId)) as Case)
          : ((await caseService.getCaseByAlertId(entityId)) as Case)

      const ruleInstanceIds =
        entityType === 'CASE'
          ? _case?.alerts?.map((a) => a.ruleInstanceId as string) || []
          : [
              _case?.alerts?.find((a) => a.alertId === entityId)
                ?.ruleInstanceId as string,
            ]

      const user = await userService.getUser(
        _case?.caseUsers?.origin?.userId ||
          _case?.caseUsers?.destination?.userId ||
          ''
      )

      const ruleInstanceRepository = new RuleInstanceRepository(ctx.tenantId, {
        dynamoDb: getDynamoDbClientByEvent(event),
      })

      const [transactions, ruleInstances] = await Promise.all([
        txnRepository.getTransactionsByIds(_case.caseTransactionsIds || []),
        ruleInstanceRepository.getRuleInstancesByIds(
          ruleInstanceIds.filter((id) => id)
        ),
      ])

      if (_case) {
        return copilotService.getCaseNarrative({
          _case,
          user,
          reasons,
          transactions,
          ruleInstances,
        })
      }
      throw new NotFound('Case not found')
    })

    handlers.registerFormatNarrative(async (_ctx, request) => {
      const copilotService = await CopilotService.new(event)
      return copilotService.formatNarrative(request)
    })

    handlers.registerGetQuestions(async (_ctx, request) => {
      const questionService = await QuestionService.fromEvent(event)
      const alert = await alertsService.getAlert(request.alertId)
      if (!alert?.caseId) {
        throw new Error(`Alert ${alert?.alertId} has no case ID`)
      }
      const c = await caseService.getCase(alert.caseId)
      return await questionService.getQuestions(alert, c)
    })

    const questionService = await QuestionService.fromEvent(event)
    handlers.registerPostQuestion(async (ctx, request) => {
      const caseService = await CaseService.fromEvent(event)
      const alertService = await AlertsService.fromEvent(event)
      const alert = await alertService.getAlert(request.alertId)
      if (!alert?.caseId) {
        throw new Error(`Alert ${alert?.alertId} has no case ID`)
      }
      const c = await caseService.getCase(alert.caseId)
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
      return {
        suggestions: autocomplete.autocomplete(request.question || '', c),
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
