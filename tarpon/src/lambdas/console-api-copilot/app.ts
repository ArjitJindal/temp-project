import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { compile } from 'handlebars'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CopilotService } from '@/services/copilot/copilot-service'
import { CaseService } from '@/lambdas/console-api-case/services/case-service'
import { UserService } from '@/lambdas/console-api-user/services/user-service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ReportService } from '@/services/sar/service'
import { getAddress, getUserName } from '@/utils/helpers'

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
        const c = await caseService.getCase(report.caseId)
        const userId =
          c.caseUsers?.origin?.userId || c.caseUsers?.destination?.userId
        if (!userId) {
          throw new NotFound('No user for found for report')
        }
        const user = await userService.getUser(userId)
        const reportTemplate = compile(REPORT_DEMO_NARRATIVE_TEMPLATE)
        const transactionId = report.parameters.transactions?.at(0)?.id
        const transaction = c.caseTransactions?.find(
          (t) => t.transactionId === transactionId
        )
        if (!transaction) {
          throw new NotFound(`Transaction ${transactionId} not found`)
        }

        const amount =
          transaction.originAmountDetails?.transactionAmount || 9000
        const narrative = reportTemplate({
          transactionDate: new Date(transaction.timestamp).toDateString(),
          transactionId: transaction.transactionId,
          name: getUserName(user),
          address: getAddress(user),
          transactionIds: c.caseTransactionsIds
            ?.filter((t) => t != transaction.transactionId)
            ?.join(', ')
            .slice(0, 5),
          amount: `$${amount}`,
          upperAmount: `$${Math.round(amount * 1.02)}`,
        })
        return {
          narrative,
        }
      }

      const _case = await caseService.getCase(entityId)
      const user = await userService.getUser(
        _case?.caseUsers?.origin?.userId ||
          _case?.caseUsers?.destination?.userId ||
          ''
      )

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
          historicalCase:
            caseResponse.data.length > 0 ? caseResponse.data[0] : undefined,
          user,
          reasons,
        })
      }
      throw new NotFound('Case not found')
    })

    return await handlers.handle(event)
  }
)

const REPORT_DEMO_NARRATIVE_TEMPLATE = `On {{ transactionDate }}, a deposit amount of {{ amount }} with transaction ID: {{ transactionId }} was made into the account held by {{ name }}, {{ address }}. This transaction is deemed suspicious due to the following factors:

Unusual Transaction Amount: The deposit amount of {{ amount }} is just below the $10,000 threshold for Currency Transaction Report (CTR) reporting requirements. This suggests an attempt to avoid reporting.

Frequent Structuring: Review of account activity shows a pattern of consistent cash deposits with transaction IDs: {{ transactionIds }} ranging from {{ amount }} to {{ upperAmount }} over the past six weeks, all just below the CTR threshold. This structuring behaviour raises suspicions of an intentional effort to evade reporting obligations.

Rapid Changes in Deposit Frequency: Prior to this pattern, {{ name }}'s account exhibited sporadic deposits and was largely inactive. The sudden and consistent series of near-threshold cash deposits deviates from historical banking behaviour.

No Observable Source of Funds: There is no evident business or personal justification provided for the repeated cash deposits. {{ name }} is not known to be involved in any cash-intensive professions.

Recent Changes in Behaviour: {{ name }} has also initiated several large transfers to overseas accounts within the past month, without a clear business rationale. This international activity, coupled with unexplained domestic cash deposits, raises concerns about potential illicit financial activity.

Given the observed transaction patterns, structured deposits, and unexplained international transfers, this activity warrants further investigation to determine whether it is indicative of money laundering or other financial improprieties. Law enforcement is advised to evaluate these patterns in context with any potential connections to illicit activities.
`
