import { OpenAI } from 'openai'
import { compact } from 'lodash'
import { AttributeSet } from './attributes/builder'
import { BaseNarrativeService } from './narratives'
import { CaseNarrativeService } from './narratives/case'
import { AlertNarrativeService } from './narratives/alerts'
import { SarNarrativeService } from './narratives/sar'
import { TransactionNarrativeService } from './narratives/transactions'
import { NarrativeResponse } from '@/@types/openapi-internal/NarrativeResponse'
import { traceable } from '@/core/xray'
import { prompt } from '@/utils/openai'
import { AdditionalCopilotInfo } from '@/@types/openapi-internal/AdditionalCopilotInfo'
import { logger } from '@/core/logger'
import { NarrativeType } from '@/@types/openapi-internal/NarrativeType'
import { NarrativeMode } from '@/@types/openapi-internal/NarrativeMode'

const SEPARATOR = '---'
const PROMPT = `Please provide the same text but use placeholders or data from the JSON blob below to replace all the numerical data and qualitative decisions in the given format above. Please keep the exact same format for the text, without headers, explanations, or any additional content`

@traceable
export class AutoNarrativeService {
  async getNarrative(
    type: NarrativeType,
    attributes: AttributeSet,
    additionalCopilotInfo: AdditionalCopilotInfo,
    narrativeMode: NarrativeMode,
    otherReason?: string
  ): Promise<NarrativeResponse> {
    const service = await this.getService(
      type,
      additionalCopilotInfo,
      attributes
    )
    let string = ''
    const introductoryNarrative = service.introductoryNarrative()
    string += introductoryNarrative
    string += `\n\n${SEPARATOR}\n\n`

    if (narrativeMode === 'STANDARD') {
      string += service.placeholderNarrative()
      string += `\n\n${SEPARATOR}\n\n`
    }

    const reasonNarratives = this.buildReasonNarratives(
      service,
      attributes,
      otherReason
    )

    if (reasonNarratives.length) {
      string += reasonNarratives.join(', ')
      string += `\n\n${SEPARATOR}\n\n`
    }

    if (narrativeMode === 'STANDARD') {
      string += `Please rewrite this information so that it conforms to the template above. Use natural, human-like language while maintaining professionalism. Avoid robotic or overly formal phrasing.`
    } else {
      string += `Please write a narrative in a natural, conversational way that explains the activities and why they are being reported to the financial authorities. Use clear, professional language but make it sound like it was written by a human rather than a machine.`
      string += `\n\n${SEPARATOR}\n\n`
      string += `No detailed information is required about rule, ${service.type} or any transaction details. Write everything in a single concise paragraph using natural language that a financial professional would use.`
    }

    string += `\n\n${SEPARATOR}\n\n`
    string += service.closingNarrative()
    string += `\nThe following template is for a document written by bank staff to justify their decision about reporting suspicious activity. Please rewrite this information in a natural, professional tone that sounds like it was written by an experienced financial professional.`

    if (service.textType === 'MARKDOWN') {
      string += `"You should only output markdown, no other text. Please do not include any other text than markdown."`
    } else if (service.textType === 'PLAIN') {
      string += `"You should only output plaintext, no markdown. Please do not include any other text than plaintext."`
    }

    const completionMessages: OpenAI.ChatCompletionMessageParam[] = []

    completionMessages.push({ role: 'system', content: string })

    return this.generate(completionMessages, attributes)
  }

  async getService(
    type: NarrativeType,
    additionalCopilotInfo: AdditionalCopilotInfo,
    attributes: AttributeSet
  ): Promise<BaseNarrativeService<any>> {
    switch (type) {
      case 'CASE': {
        const status = additionalCopilotInfo.newCaseStatus
        if (!status) {
          throw new Error('newCaseStatus is required for CASE narrative')
        }

        return new CaseNarrativeService({ status }, attributes)
      }

      case 'ALERT': {
        const status = additionalCopilotInfo.newAlertStatus
        if (!status) {
          throw new Error('newAlertStatus is required for ALERT narrative')
        }

        return new AlertNarrativeService({ status }, attributes)
      }

      case 'REPORT': {
        if (!additionalCopilotInfo.additionalSarInformation) {
          throw new Error(
            'additionalSarInformation is not supported for REPORT narrative'
          )
        }

        return new SarNarrativeService(
          additionalCopilotInfo.additionalSarInformation ?? {},
          attributes
        )
      }

      case 'TRANSACTION': {
        const action = additionalCopilotInfo.action

        if (!action) {
          throw new Error('action is required for TRANSACTION narrative')
        }
        return new TransactionNarrativeService({ action }, attributes)
      }

      default:
        throw new Error(`Unsupported narrative type: ${type}`)
    }
  }

  public buildReasonNarratives(
    narrativeInstance: BaseNarrativeService<any>,
    attributes: AttributeSet,
    otherReason?: string
  ): string[] {
    const reasons = compact(attributes.getAttribute('reasons'))
    const reasonNarrs = compact(reasons)?.map(
      (reason: string) =>
        narrativeInstance.reasonNarratives().find((rn) => rn.reason === reason)
          ?.narrative
    )

    if (otherReason) {
      reasonNarrs.push(`for the other reason: ${otherReason}`)
    }

    const reasonsNotInCaseReasons = compact(reasons)

    if (reasonsNotInCaseReasons.length) {
      reasonNarrs.push(
        `${
          otherReason ? 'and also' : ''
        } for the reason: ${reasonsNotInCaseReasons.join(', ')}`
      )
    }

    return compact(reasonNarrs)
  }

  private async generate(
    promptMessages: OpenAI.ChatCompletionMessageParam[],
    attributes: AttributeSet
  ): Promise<NarrativeResponse> {
    const serialisedAttributes = await attributes.serialise()
    const promptWithContext = promptMessages.concat([
      {
        role: 'system',
        content: `Here is some data that you can use to write the narrative: ${serialisedAttributes}`,
      },
    ])

    let response = ''

    for (let i = 0; i < 3; i++) {
      try {
        response = await prompt(promptWithContext)
        break
      } catch (e) {
        logger.error(e)
      }
    }

    response = await attributes.inject(response)

    // Clean up response
    response = response
      .replace(new RegExp(SEPARATOR, 'g'), '')
      .replace(new RegExp(PROMPT, 'g'), '')
      .trim()

    return {
      narrative: response,
      attributes: await attributes.present(attributes),
    }
  }

  async formatNarrative(
    narrative: string,
    attributes: AttributeSet
  ): Promise<NarrativeResponse> {
    return await this.generate(
      [
        {
          role: 'system',
          content: `Please correct any spelling or grammatical errors in the following text and make it sound professional: "${narrative}"`,
        },
      ],
      attributes
    )
  }
}
