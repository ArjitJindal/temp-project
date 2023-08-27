import { Configuration, OpenAIApi } from 'openai'
import { NarrativeResponse } from '@/@types/openapi-internal/NarrativeResponse'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'
import { getUserName } from '@/utils/helpers'
import { getSecret } from '@/utils/secrets-manager'

type GenerateNarrative = {
  _case: Case
  user: InternalBusinessUser | InternalConsumerUser
  historicalCase?: Case
  reasons: CaseReasons[]
}

const PROMPT = `Please provide the same text but with placeholders to replace all the numerical data and qualitative decisions in the given format above. Please keep the exact same format for the text, without headers, explanations, or any additional content`
const PLACEHOLDER_NARRATIVE = `# Overview
User: [Insert user's name]
Date of Case Generation: [Insert date]
Reason for Case Generation: [Insert reasons for the case/alert]
Investigation Period: [Insert start date] - [Insert end date]
Closure Date: [Insert closure date]

# Background
[This section could contain general details about the user in question.]

# Investigation
[This section could detail the method of the investigation and the user's activities that took place during the investigation.]

# Findings and Assessment
[This section could contain an analysis of the user's transactions and behaviors.]

# Screening Details
[This section could contain information about sanctions, politically exposed persons (PEP), or adverse media screening results, for example.]

# Conclusion
[This section could contain the end result of the investigation.]

`
const MAX_TOKEN_INPUT = 1000
const MAX_TOKEN_OUTPUT = 4096

@traceable
export class CopilotService {
  private readonly openAiApiKey!: string

  public static async new() {
    const openApi = await getSecret<{ apiKey: string }>(
      process.env.OPENAI_CREDENTIALS_SECRET_ARN as string
    )
    return new this(openApi.apiKey)
  }

  constructor(openApiKey: string) {
    this.openAiApiKey = openApiKey
  }

  async getNarrative(request: GenerateNarrative): Promise<NarrativeResponse> {
    try {
      const exampleNarrative = `Our AI does not have past data from which to generate a narrative from. Instead, please refer to this example narrative which you can adjust for your purposes. \n\n${PLACEHOLDER_NARRATIVE.replace(
        '{{ name }}',
        getUserName(request.user)
      )}`

      if (!request.historicalCase?.lastStatusChange?.comment) {
        return {
          narrative: exampleNarrative,
        }
      }

      const configuration = new Configuration({
        apiKey: this.openAiApiKey,
      })
      const content =
        `${request.historicalCase.lastStatusChange?.comment} ${PROMPT}`.slice(
          0,
          MAX_TOKEN_OUTPUT
        )
      const openai = new OpenAIApi(configuration)
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            content,
            role: 'assistant',
          },
        ],
        max_tokens: MAX_TOKEN_INPUT,
      })
      return {
        narrative:
          completion.data.choices[0].message?.content.replace(PROMPT, '') ||
          exampleNarrative,
      }
    } catch (e) {
      logger.error(e)
      throw e
    }
  }
}
