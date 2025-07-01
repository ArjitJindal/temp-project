import OpenAI from 'openai'
import { getSecret } from '../secrets-manager'
import { BaseLLMService, Message, LLMOptions, ModelTier } from './base-service'
import { LLMProvider } from '@/@types/openapi-internal/LLMProvider'

export class OpenAIService extends BaseLLMService<OpenAI> {
  protected async getClient(): Promise<OpenAI> {
    const { apiKey } = await getSecret<{ apiKey: string }>('openAI')
    return new OpenAI({
      apiKey,
    })
  }

  protected defaultMaxTokens = 4096
  protected defaultTemperature = 0.5
  protected provider: LLMProvider = 'OPEN_AI'

  protected modelClassification: Record<ModelTier, string> = {
    [ModelTier.ENTERPRISE]: 'gpt-4.1',
    [ModelTier.PROFESSIONAL]: 'gpt-4o',
    [ModelTier.STANDARD]: 'gpt-4o-mini',
    [ModelTier.ECONOMY]: 'gpt-3.5-turbo',
  }

  public async prompt(
    messages: Message[],
    options?: LLMOptions
  ): Promise<string> {
    const configuredOptions = await this.getConfiguredOptions(options)

    const client = await this.getCachedClient()
    const completion = await client.chat.completions.create({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      model: this.modelClassification[configuredOptions.tier],
      max_tokens: configuredOptions.maxTokens,
      temperature: configuredOptions.temperature,
    })

    const response = completion.choices[0].message.content || ''

    if (response) {
      await this.logResponse(this.tenantId, messages, response)
    }

    return response
  }
}
