import { OpenAI } from 'openai'
import { AttributeSet } from './attributes/builder'
import { NarrativeResponse } from '@/@types/openapi-internal/NarrativeResponse'
import { traceable } from '@/core/xray'
import { reasonNarratives } from '@/services/copilot/reason-narratives'
import { prompt } from '@/utils/openai'
import { getContext } from '@/core/utils/context'

const SEPARATOR = '---'
const PROMPT = `Please provide the same text but use placeholders or data from the JSON blob below to replace all the numerical data and qualitative decisions in the given format above. Please keep the exact same format for the text, without headers, explanations, or any additional content`

const PLACEHOLDER_NARRATIVE = (type: string, attributes: AttributeSet) => {
  const isScreening = attributes
    ?.getAttribute('rules')
    ?.some((r) => r.narrative === 'SCREENING')
  const overview = `OVERVIEW \n\nName: [name] \n\nDate of Case Generation: [caseGenerationDate] \n\nReason for Case Generation: [ruleHitNames] \n\nInvestigation Period: [caseGenerationDate] - [closureDate] \n\nClosure Date: [closureDate]`
  const background = `BACKGROUND \n\n[This section should contain general details about the ${type} in question.]`
  const investigation = `INVESTIGATION \n\n[This section should detail the method of the investigation and the ${type}'s activities that took place during the investigation.]`
  const findings = `FINDINGS AND ASSESSMENT \n\n[This section should contain an analysis of the ${type}'s transactions and behaviors.]`
  const screening = `SCREENING DETAILS \n\n[This section should contain information about sanctions, politically exposed persons (PEP), or adverse media screening results. If there is no information like this it can be neglected.]`
  const conclusion = `CONCLUSION`

  if (isScreening) {
    return (
      overview + background + investigation + findings + screening + conclusion
    )
  }

  return overview + background + investigation + findings + conclusion
}

@traceable
export class AutoNarrativeService {
  async getSarNarrative(attributes: AttributeSet): Promise<NarrativeResponse> {
    return this.generate(
      [
        {
          role: 'system',
          content: 'Please only output plaintext, markdown is not supported',
        },
        {
          role: 'system',
          content: `
    The following is a template for suspicious activity report written by bank staff to justify why they are reporting a ${
      attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'
    } to the financial authorities.
    
    Example:
    ${attributes
      .getAttribute('rules')
      ?.map((r) => r.narrative)
      .join(', ')}"
    
    Please fill in the template above with relevant data from the following JSON blob maintaining the exact same structure and correct any spelling mistakes or grammatical errors:
    `,
        },
      ],
      attributes
    )
  }

  async getNarrative(attributes: AttributeSet): Promise<NarrativeResponse> {
    const customerType =
      attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'

    const narrativeSize = getContext()?.settings?.narrativeMode ?? 'STANDARD'

    const reasonNarrs = attributes
      .getAttribute('reasons')
      .map(
        (reason) =>
          reasonNarratives.find((rn) => rn.reason === reason)?.narrative
      )

    let string = `The following is a template for a document written by bank staff to justify why they have or have not reported a suspicious ${customerType} to the financial authorities.`
    string += `\n\n${SEPARATOR}\n\n`

    if (narrativeSize === 'STANDARD') {
      string += PLACEHOLDER_NARRATIVE(customerType, attributes)
      string += `\n\n${SEPARATOR}\n\n`
    }

    string += reasonNarrs.join(', ')

    string += `The following JSON blob is information relevant to a single ${customerType} who is under investigation by bank staff.\n\n`

    string += `\n\n${SEPARATOR}\n\n`

    if (narrativeSize === 'STANDARD') {
      string += `Please rewrite this information so that it conforms to the template above.`
    } else {
      string += `Please write a narrative strictly in a paragraph (no verbose) straightforward way that explains the ${customerType}'s activities and why they are being reported to the financial authorities.`
      string += `\n\n${SEPARATOR}\n\n`
      string += `No detailed information is required about rule, case or any transaction details accommodate everything in a single paragraph and in a very concise and professional manner.`
    }

    string += `\n\n${SEPARATOR}\n\n`

    string += `The following JSON blob is information relevant to a single ${customerType} who is under investigation by bank staff, please rewrite this information so that it conforms to the template above. This case is being closed for the following reasons: ${attributes
      .getAttribute('reasons')
      .join(', ')}.`

    return this.generate(
      [
        {
          content: string,
          role: 'system',
        },
      ],
      attributes
    )
  }

  private async generate(
    promptMessages: OpenAI.ChatCompletionMessageParam[],
    attributes: AttributeSet
  ) {
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
        console.log(e)
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
