import { NarrativeResponse } from '@/@types/openapi-internal/NarrativeResponse'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { generateNarrative } from '@/core/seed/samplers/cases'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import {
  AttributeGenerator,
  DefaultAttributeBuilders,
} from '@/services/copilot/attributes/builder'
import { traceable } from '@/core/xray'

type GenerateNarrative = {
  _case: Case
  user: InternalBusinessUser | InternalConsumerUser
  historicalCases: Case[]
  reasons: CaseReasons[]
}

@traceable
export class CopilotService {
  async getNarrative(request: GenerateNarrative): Promise<NarrativeResponse> {
    // Timeout so that the delay seems like it could actually come from ChatGPT.
    let i = 0
    while (i < 500_000_000) {
      i++
    }

    const attributeBuilder = new AttributeGenerator(DefaultAttributeBuilders)
    const attributes = attributeBuilder.getAttributes({
      transactions: request._case.caseTransactions || [],
      user: request.user,
      _case: request._case,
    })

    const narrativeContext = `The user had ${attributes.getAttribute(
      'roundTransactionsCount'
    )} round amount transactions of ${attributes.getAttribute(
      'transactionsCount'
    )} total transactions. ${attributes.getAttribute(
      'distinctOriginPaymentMethodCount'
    )} different payment methods were used.`

    const generatedNarrative = generateNarrative(
      request._case.alerts?.map((a) => a.ruleName) || [],
      request.reasons,
      request.user,
      narrativeContext
    )
    const website =
      request?.user.type === 'BUSINESS' &&
      request.user.legalEntity.contactDetails?.websites
        ? request.user.legalEntity.contactDetails?.websites[0]
        : undefined

    return {
      caseId: request._case.caseId as string,
      createdAt: new Date().getTime(),
      attributes: [...attributes.entries()].map((f) => {
        const [attribute, value] = f
        return {
          attribute,
          value,
        }
      }),
      narrative: generatedNarrative,
      userPrompts: [
        {
          text: 'Is there a suspicious pattern with the round payments?',
          link: `/users/list/${request.user.type.toLowerCase()}/${
            request.user.userId
          }/transaction-history`,
        },
        {
          text: "Are prices on the merchant's website consistent with their transactions?",
          link: `https://${website?.replace('https://', '')}`,
        },
      ],
    }
  }
}
