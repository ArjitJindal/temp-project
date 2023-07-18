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

export const copilotHandler = lambdaApi({ requiredFeatures: ['COPILOT'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const copilotService = new CopilotService()
    const caseService = await CaseService.fromEvent(event)
    const userService = await UserService.fromEvent(event)

    const handlers = new Handlers()

    handlers.registerGenerateNarrative(async (ctx, request) => {
      const { caseId, reasons } = request.NarrativeRequest
      const _case = await caseService.getCase(caseId)
      const user = await userService.getUser(
        _case?.caseUsers?.origin?.userId ||
          _case?.caseUsers?.destination?.userId ||
          ''
      )

      // TODO figure out how to best engineer the prompt for more examples, currently just supplying one
      const caseResponse = await caseService.getCases({
        filterCaseStatus: ['CLOSED'],
        filterCaseClosureReasons: reasons,
        sortField: 'createdTimestamp',
        sortOrder: 'descend',
        page: 1,
        pageSize: 1,
      })

      if (_case) {
        return copilotService.getNarrative({
          _case,
          historicalCases: caseResponse.data,
          user,
          reasons,
        })
      }
      throw new NotFound('Case not found')
    })

    return await handlers.handle(event)
  }
)
