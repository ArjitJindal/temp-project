import Anthropic from '@anthropic-ai/sdk'
import { getSecret } from '../secrets-manager'
import { BaseLLMService, Message, LLMOptions, ModelTier } from './base-service'
import { LLMProvider } from '@/@types/openapi-internal/LLMProvider'

export class AnthropicService extends BaseLLMService<Anthropic> {
  protected async getClient(): Promise<Anthropic> {
    const { apiKey } = await getSecret<{ apiKey: string }>('anthropic')
    return new Anthropic({
      apiKey,
    })
  }

  protected defaultMaxTokens = 4096
  protected defaultTemperature = 0.5
  protected provider: LLMProvider = 'ANTHROPIC'

  protected modelClassification: Record<ModelTier, string> = {
    [ModelTier.ENTERPRISE]: 'claude-sonnet-4-20250514',
    [ModelTier.PROFESSIONAL]: 'claude-3-7-sonnet-20250219',
    [ModelTier.STANDARD]: 'claude-3-5-haiku-20241022',
    [ModelTier.ECONOMY]: 'claude-3-haiku-20240307',
  }

  public async prompt(
    messages: Message[],
    options?: LLMOptions
  ): Promise<string> {
    const configuredOptions = await this.getConfiguredOptions(options)

    // Convert messages to Anthropic's format
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.role === 'system' ? `System: ${msg.content}` : msg.content,
    }))

    const client = await this.getCachedClient()
    const completion = await client.messages.create({
      model: this.modelClassification[configuredOptions.tier],
      messages: anthropicMessages,
      max_tokens: configuredOptions.maxTokens,
      temperature: configuredOptions.temperature,
      stream: false,
    })

    const response =
      completion.content[0].type === 'text' ? completion.content[0].text : ''

    if (response) {
      await this.logResponse(this.tenantId, messages, response)
    }

    return response
  }
}
