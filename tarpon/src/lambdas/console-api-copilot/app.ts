import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CopilotService } from '@/services/copilot/copilot-service'
import { CaseService } from '@/lambdas/console-api-case/services/case-service'
import { UserService } from '@/lambdas/console-api-user/services/user-service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ReportService } from '@/services/sar/service'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export const copilotHandler = lambdaApi({ requiredFeatures: ['COPILOT'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const [copilotService, caseService, userService] = await Promise.all([
      CopilotService.new(),
      CaseService.fromEvent(event),
      UserService.fromEvent(event),
    ])
    const handlers = new Handlers()

    handlers.registerGenerateNarrative(async (ctx, request) => {
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
        const transactions =
          report.parameters.transactions
            ?.map((t) => {
              return _case.caseTransactions?.find(
                (ct) => ct.transactionId === t.id
              )
            })
            .filter((t): t is InternalTransaction => Boolean(t)) || []
        return copilotService.getSarNarrative({
          _case,
          user,
          reasons,
          transactions,
        })
      }

      const _case = await caseService.getCase(entityId)
      const user = await userService.getUser(
        _case?.caseUsers?.origin?.userId ||
          _case?.caseUsers?.destination?.userId ||
          ''
      )

      if (_case) {
        return copilotService.getCaseNarrative({
          _case,
          user,
          reasons,
        })
      }
      throw new NotFound('Case not found')
    })

    handlers.registerFormatNarrative(async (_ctx, request) => {
      return copilotService.formatNarrative(request)
    })

    return await handlers.handle(event)
  }
)
