import { OpenAI } from 'openai'
import { compact } from 'lodash'
import { AttributeSet } from './attributes/builder'
import { BaseNarrativeService } from './narratives'
import { CaseNarrativeService } from './narratives/case'
import { AlertNarrativeService } from './narratives/alerts'
import { SarNarrativeService } from './narratives/sar'
import { NarrativeResponse } from '@/@types/openapi-internal/NarrativeResponse'
import { traceable } from '@/core/xray'
import { prompt } from '@/utils/openai'
import { getContext } from '@/core/utils/context'
import { AdditionalCopilotInfo } from '@/@types/openapi-internal/AdditionalCopilotInfo'
import { logger } from '@/core/logger'
import { NarrativeType } from '@/@types/openapi-internal/NarrativeType'

const SEPARATOR = '---'
const PROMPT = `Please provide the same text but use placeholders or data from the JSON blob below to replace all the numerical data and qualitative decisions in the given format above. Please keep the exact same format for the text, without headers, explanations, or any additional content`

@traceable
export class AutoNarrativeService {
  async getNarrative(
    type: NarrativeType,
    attributes: AttributeSet,
    additionalCopilotInfo: AdditionalCopilotInfo,
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

    const narrativeSize = getContext()?.settings?.narrativeMode ?? 'STANDARD'

    if (narrativeSize === 'STANDARD') {
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

    if (narrativeSize === 'STANDARD') {
      string += `Please rewrite this information so that it conforms to the template above.`
    } else {
      string += `Please write a narrative strictly in a paragraph (no verbose) straightforward way that explains the activities and why they are being reported to the financial authorities.`
      string += `\n\n${SEPARATOR}\n\n`
      string += `No detailed information is required about rule, ${service.type} or any transaction details accommodate everything in a single paragraph and in a very concise and professional manner.`
    }

    string += `\n\n${SEPARATOR}\n\n`
    string += service.closingNarrative()
    string += `\nThe following template is a template for a document written by bank staff to justify why they have or have not reported a suspicious, please rewrite this information so that it conforms to the template above in a very professional manner.`

    const completionMessages: OpenAI.ChatCompletionMessageParam[] = []

    if (service.textType !== 'MARKDOWN') {
      completionMessages.push({
        role: 'system',
        content: 'Please only output plaintext, markdown is not supported',
      })
    }

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
        return new SarNarrativeService({}, attributes)
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
    const reasonNarrs = compact(attributes.getAttribute('reasons'))?.map(
      (reason: string) =>
        narrativeInstance.reasonNarratives().find((rn) => rn.reason === reason)
          ?.narrative
    )

    if (otherReason) {
      reasonNarrs.push(`for the other reason: ${otherReason}`)
    }

    const reasonsNotInCaseReasons = compact(attributes.getAttribute('reasons'))

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
        content: serialisedAttributes,
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
