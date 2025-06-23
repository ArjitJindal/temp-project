import { GPT_REQUESTS_COLLECTION } from '../mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { LLMProvider } from '@/@types/openapi-internal/LLMProvider'

export enum ModelTier {
  ENTERPRISE = 'enterprise', // Highest performance, largest context
  PROFESSIONAL = 'professional', // High performance, large context
  STANDARD = 'standard', // Balanced performance and cost
  ECONOMY = 'economy', // Cost-effective, basic capabilities
}

export type ModelMetadata = {
  tier: ModelTier
}

export type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LLMOptions = {
  tier?: ModelTier
  maxTokens?: number
  temperature?: number
  provider?: LLMProvider
}

export type GPTLogObject = {
  prompts: Message[]
  response: string
  createdAt: number
}

export abstract class BaseLLMService<Client> {
  protected client: Client | null = null
  protected abstract getClient(): Promise<Client>
  protected tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  protected async getCachedClient(): Promise<Client> {
    if (!this.client) {
      this.client = await this.getClient()
    }
    return this.client
  }

  protected abstract defaultMaxTokens: number
  protected abstract defaultTemperature: number
  protected abstract provider: LLMProvider

  protected abstract modelClassification: Record<ModelTier, string>

  protected async getConfiguredOptions(
    options?: LLMOptions
  ): Promise<Required<LLMOptions>> {
    return {
      tier: options?.tier ?? ModelTier.ENTERPRISE,
      maxTokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
      provider: options?.provider ?? this.provider,
    }
  }

  protected async logResponse(
    tenantId: string,
    messages: Message[],
    response: string
  ): Promise<void> {
    const mongodbClient = await getMongoDbClient()
    const db = mongodbClient.db()
    const collection = db.collection<GPTLogObject>(
      GPT_REQUESTS_COLLECTION(tenantId)
    )

    await collection.insertOne({
      prompts: messages,
      response,
      createdAt: Date.now(),
    })
  }

  public abstract prompt(
    messages: Message[],
    options?: LLMOptions
  ): Promise<string>

  public async ask(
    promptString: string,
    options?: LLMOptions
  ): Promise<string> {
    return this.prompt([{ role: 'user', content: promptString }], options)
  }
}
