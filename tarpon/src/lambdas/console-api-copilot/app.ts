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

export const copilotHandler = lambdaApi({})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const [caseService, userService] = await Promise.all([
      CaseService.fromEvent(event),
      UserService.fromEvent(event),
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
      const copilotService = await CopilotService.new(event)
      return copilotService.formatNarrative(request)
    })

    handlers.registerGetQuestion(async (_ctx, request) => {
      if (request.questionId === 'TABLE') {
        return {
          questionId: request.questionId,
          questionType: request.questionId,
          variableOptions: [
            { name: 'startTimestamp', variableType: 'DATETIME' },
          ],
          rows: [...Array(10).keys()].map((_, i) => [
            `string#${i}`,
            new Date().valueOf() - Math.round(24 * 3600 * 1000 * Math.random()),
            'some other string#${i}',
          ]),
          headers: [
            {
              name: 'str1',
              columnType: 'STRING',
            },
            {
              name: 'date',
              columnType: 'DATETIME',
            },
            {
              name: 'str2',
              columnType: 'STRING',
            },
          ],
        }
      }
      if (request.questionId === 'STACKED_BARCHART') {
        return {
          questionId: request.questionId,
          questionType: request.questionId,
          variableOptions: [
            { name: 'startTimestamp', variableType: 'DATETIME' },
          ],
          series: [
            {
              label: 'series1',
              values: [
                {
                  x: 'thing1',
                  y: 10,
                },
                {
                  x: 'thing2',
                  y: 5,
                },
                {
                  x: 'thing3',
                  y: 20,
                },
              ],
            },
            {
              label: 'series2',
              values: [
                {
                  x: 'thing1',
                  y: 2,
                },
                {
                  x: 'thing2',
                  y: 1,
                },
                {
                  x: 'thing3',
                  y: 6,
                },
              ],
            },
          ],
        }
      }
      if (request.questionId === 'TIMESERIES') {
        return {
          questionId: request.questionId,
          questionType: request.questionId,
          variableOptions: [
            { name: 'startTimestamp', variableType: 'DATETIME' },
          ],
          timeseries: [
            {
              label: 'series1',
              values: [
                {
                  time: new Date().setDate(new Date().getDate() - 2).valueOf(),
                  value: 10,
                },
                {
                  time: new Date().setDate(new Date().getDate() - 1).valueOf(),
                  y: 5,
                },
                {
                  time: new Date().valueOf(),
                  y: 20,
                },
              ],
            },
            {
              label: 'series2',
              values: [
                {
                  time: new Date().setDate(new Date().getDate() - 2).valueOf(),
                  value: 5,
                },
                {
                  time: new Date().setDate(new Date().getDate() - 1).valueOf(),
                  y: 10,
                },
                {
                  time: new Date().valueOf(),
                  y: 2,
                },
              ],
            },
          ],
        }
      }
      throw new Error()
    })

    return await handlers.handle(event)
  }
)
