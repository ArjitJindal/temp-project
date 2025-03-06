import { OpenAI } from 'openai'
import { getSecret } from './secrets-manager'
import { GPT_REQUESTS_COLLECTION } from './mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'

let openai: OpenAI | null = null

export enum ModelVersion {
  GPT3 = 'gpt-3.5-turbo',
  GPT4 = 'gpt-4-turbo-preview',
  GPT4O = 'gpt-4o',
  GPT4O_MINI = 'gpt-4o-mini',
}
const modelVersion: ModelVersion = ModelVersion.GPT4O

export type GPTLogObject = {
  prompts: any
  response: string
  createdAt: number
}

export async function ask(
  promptString: string,
  options?: Partial<OpenAI.ChatCompletionCreateParamsNonStreaming>
): Promise<string> {
  return prompt(
    [
      {
        role: 'system',
        content: promptString,
      },
    ],
    options
  )
}

export async function prompt(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: Partial<OpenAI.ChatCompletionCreateParamsNonStreaming>
): Promise<string> {
  const tenantId = getContext()?.tenantId

  if (!openai) {
    const { apiKey } = await getSecret<{ apiKey: string }>('openAI')
    openai = new OpenAI({
      apiKey,
    })
  }

  const completion = await openai.chat.completions.create({
    ...options,
    messages,
    model: options?.model ?? modelVersion,
    store: false,
    temperature: options?.temperature ?? 0.5,
  })

  const completionChoice = completion.choices[0].message.content || ''

  tenantId && (await logGPTResponses(tenantId, messages, completionChoice))

  return completionChoice
}

async function logGPTResponses(
  tenantId: string,
  prompts: OpenAI.ChatCompletionMessageParam[],
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
