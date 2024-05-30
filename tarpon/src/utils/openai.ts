import { Configuration, OpenAIApi } from 'openai'
import {
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
} from 'openai/api'
import { getSecret } from './secrets-manager'
import { GPT_REQUESTS_COLLECTION } from './mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'

const MAX_TOKEN_INPUT = 1000
let openai: OpenAIApi | null = null

export enum ModelVersion {
  GPT3 = 'gpt-3.5-turbo',
  GPT4 = 'gpt-4-turbo-preview',
  GPT4O = 'gpt-4o',
}
const modelVersion: ModelVersion = ModelVersion.GPT4

export type GPTLogObject = {
  prompts: string[] | ChatCompletionRequestMessage[]
  response: string
  createdAt: number
}

export async function ask(
  prompt: string,
  params?: { temperature?: number; modelVersion?: ModelVersion }
): Promise<string> {
  const tenantId = getContext()?.tenantId
  if (!openai) {
    const { apiKey } = await getSecret<{ apiKey: string }>('openAI')
    openai = new OpenAIApi(
      new Configuration({
        apiKey,
      })
    )
  }

  const completion = await openai.createChatCompletion({
    model: params?.modelVersion ?? modelVersion,
    temperature: params?.temperature ?? 0.5,
    messages: [
      {
        content: prompt,
        role: 'assistant',
      },
    ],
    max_tokens: MAX_TOKEN_INPUT,
  })
  const completionChoice = completion.data.choices[0].message?.content || ''
  tenantId && (await logGPTResponses(tenantId, [prompt], completionChoice))
  return completionChoice
}

export async function prompt(
  messages: ChatCompletionRequestMessage[],
  params?: Partial<CreateChatCompletionRequest>
): Promise<string> {
  const tenantId = getContext()?.tenantId

  if (!openai) {
    const { apiKey } = await getSecret<{ apiKey: string }>('openAI')
    openai = new OpenAIApi(
      new Configuration({
        apiKey,
      })
    )
  }

  const completion = await openai.createChatCompletion({
    model: modelVersion,
    temperature: params?.temperature ?? 0.5,
    messages,
    max_tokens: MAX_TOKEN_INPUT,
    ...params,
  })
  const completionChoice = completion.data.choices[0].message?.content || ''

  tenantId && (await logGPTResponses(tenantId, messages, completionChoice))

  return completionChoice
}

async function logGPTResponses(
  tenantId: string,
  prompts: string[] | ChatCompletionRequestMessage[],
  completionChoice: string
) {
  const mongodbClient = await getMongoDbClient()
  const db = mongodbClient.db()
  const collection = db.collection<GPTLogObject>(
    GPT_REQUESTS_COLLECTION(tenantId)
  )
  await collection.insertOne({
    prompts: prompts,
    response: completionChoice,
    createdAt: Date.now(),
  })
}
