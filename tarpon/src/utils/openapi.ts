import { Configuration, OpenAIApi } from 'openai'
import { getSecret } from './secrets-manager'

const MAX_TOKEN_INPUT = 1000
let openai: OpenAIApi | null = null

export async function ask(prompt: string): Promise<string> {
  if (!openai) {
    const { apiKey } = await getSecret<{ apiKey: string }>(
      process.env.OPENAI_CREDENTIALS_SECRET_ARN as string
    )
    openai = new OpenAIApi(new Configuration({ apiKey }))
  }
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    temperature: 0.5,
    messages: [
      {
        content: prompt,
        role: 'assistant',
      },
    ],
    max_tokens: MAX_TOKEN_INPUT,
  })
  return completion.data.choices[0].message?.content || ''
}
