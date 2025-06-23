import { uniq } from 'lodash'
import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import { QuestionCategory } from './types'
import {
  getQueries,
  getQuestions,
} from '@/services/copilot/questions/definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { QuestionVariable } from '@/@types/openapi-internal/QuestionVariable'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { addSentryExtras } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { prompt } from '@/utils/llms'
import { Message, ModelTier } from '@/utils/llms/base-service'

const MAX_DISTANCE = 2
const LIMIT = 30

@traceable
export class AutocompleteService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private phrases: string[] = getQuestions().map((q) =>
    q.questionId.toLowerCase()
  )

  autocomplete(query: string, c?: Case | null): string[] {
    query = query.toLowerCase()
    const prefixResults: string[] = []
    const results: { phrase: string; distance: number }[] = []

    const user = c?.caseUsers?.origin || c?.caseUsers?.destination
    const userCategory: QuestionCategory | undefined = user
      ? isBusinessUser(user as InternalUser)
        ? 'BUSINESS'
        : 'CONSUMER'
      : c?.paymentDetails
      ? 'PAYMENT'
      : undefined
    for (const completePhrase of this.phrases) {
      for (const phrase of splitStringIntoSubstrings(completePhrase)) {
        const distance = this.calculateLevenshteinDistance(query, phrase)

        if (distance <= MAX_DISTANCE) {
          results.push({ phrase: completePhrase, distance })
        }

        if (phrase.includes(query)) {
          prefixResults.push(completePhrase)
        }
      }
    }

    prefixResults.sort() // Sort prefix results alphabetically
    results.sort((a, b) => a.distance - b.distance)

    // Combine prefix results and Levenshtein results up to the limit
    const combinedResults = [
      ...prefixResults,
      ...results.map((result) => result.phrase),
    ]

    // Repair casing
    const questions = getQuestions()
    const data = uniq(combinedResults)
      .filter((r) => {
        if (!userCategory) {
          return true
        }
        const question = questions.find((q) => q.questionId.toLowerCase() === r)
        return question && question.categories.includes(userCategory)
      })
      .map((r) => {
        return (
          getQuestions().find((q) => q.questionId.toLowerCase() === r)
            ?.questionId || ''
        )
      })
      .slice(0, LIMIT)

    return data
  }

  private calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Deletion
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        )
      }
    }

    return matrix[a.length][b.length]
  }

  public async interpretQuestion(questionPrompt: string) {
    try {
      const questions = await this.interpretQuestionWithGPT(questionPrompt)
      if (questions.length > 0) {
        return questions
      }
    } catch (e) {
      logger.error('Failed to parse JSON in response from GPT', e)
    }

    return this.autocomplete(questionPrompt).map(
      (
        questionId
      ): {
        questionId: string
        variables: QuestionVariable[]
      } => ({
        questionId,
        variables: [],
      })
    )
  }

  public async interpretQuestionWithGPT(questionPrompt: string): Promise<
    {
      questionId: string
      variables: QuestionVariable[]
    }[]
  > {
    const examples: {
      prompt: string
      response: {
        questionId: QuestionId
        variables: QuestionVariable[]
      }[]
    }[] = [
      {
        prompt: 'transactions',
        response: [
          {
            questionId: COPILOT_QUESTIONS.USER_TRANSACTIONS,
            variables: [],
          },
        ],
      },
      {
        prompt: 'transaction insights for all time',
        response: [
          {
            questionId: COPILOT_QUESTIONS.TRANSACTION_INSIGHTS,
            variables: [],
          },
        ],
      },
      {
        prompt: "user's transactions for the last 5 days",
        response: [
          {
            questionId: COPILOT_QUESTIONS.USER_TRANSACTIONS,
            variables: [
              {
                name: 'from',
                value: dayjs().subtract(5, 'd').format('YYYY-MM-DD'),
              },
              { name: 'to', value: dayjs().format('YYYY-MM-DD') },
            ],
          },
        ],
      },
      {
        prompt: 'give me some insights about the transaction references',
        response: [
          {
            questionId: COPILOT_QUESTIONS.REFERENCES_WORD_COUNT,
            variables: [],
          },
        ],
      },
      {
        prompt:
          'I also wanna seee their directors and any other details about the user',
        response: [
          {
            questionId: COPILOT_QUESTIONS.DIRECTORS,
            variables: [],
          },
          {
            questionId: COPILOT_QUESTIONS.USER_DETAILS,
            variables: [],
          },
        ],
      },
      {
        prompt: 'cases and allerts for the last two months',
        response: [
          {
            questionId: COPILOT_QUESTIONS.CASES,
            variables: [
              {
                name: 'from',
                value: dayjs().subtract(2, 'M').format('YYYY-MM-DD'),
              },
              { name: 'to', value: dayjs().format('YYYY-MM-DD') },
            ],
          },
          {
            questionId: COPILOT_QUESTIONS.ALERTS,
            variables: [
              {
                name: 'from',
                value: dayjs().subtract(2, 'M').format('YYYY-MM-DD'),
              },
              { name: 'to', value: dayjs().format('YYYY-MM-DD') },
            ],
          },
        ],
      },
    ]

    const response = await prompt(
      this.tenantId,
      [
        {
          role: 'user',
          content: `You are a machine with the following available "questions" with their corresponding "variables": ${JSON.stringify(
            getQueries().map((q) => {
              const preparedVariables = Object.entries(
                q.variableOptions
              ).flatMap(([name, definition]) => {
                if (typeof definition !== 'string') {
                  return [{ name, definition: 'STRING' }]
                }
                return [{ name, definition }]
              })
              return {
                questionId: q.questionId,
                variables: preparedVariables,
              }
            })
          )}`,
        },
        {
          role: 'user',
          content: `You will be asked a to provide a JSON array of questionId's and their corresponding "variables" based on user input. You must always return a question.`,
        },
        {
          role: 'user',
          content: `Today's date is ${dayjs().format('YYYY-MM-DD')}.`,
        },
        {
          role: 'user',
          content: `If no time range is specified, don't include "from" and "to" variables.`,
        },
        {
          role: 'user',
          content: `Unless specified, any questions for transactions will be for the question with ID "Transactions".`,
        },
        ...examples.map(
          (example): Message => ({
            role: 'user',
            content: `For the input "${
              example.prompt
            }", the following JSON response is expected:\n ${JSON.stringify({
              response: example.response,
            })}`,
          })
        ),
        {
          role: 'user',
          content: `Please parse "${questionPrompt}" to give the best matching questionIds and variables in an array. Return the response in JSON format with a "response" key containing an array of objects with "questionId" and "variables" fields. Only give json no markdown.`,
        },
      ],
      {
        tier: ModelTier.ECONOMY,
        provider: 'OPEN_AI',
      }
    )
    const results: {
      response: {
        questionId: string
        variables: QuestionVariable[]
      }[]
    } = JSON.parse(response)

    results.response = results.response.map((r) => {
      r.variables = r.variables.filter((v) => {
        return Boolean(v.value) && !['REQUIRED', 'STRING'].includes(v.value)
      })
      return r
    })

    if (results.response.length === 0) {
      addSentryExtras({ questionPrompt, response, results })
      logger.error('AI could not determine a relevant question', results)
      return []
    }
    return results.response
  }

  async autocompleteVariable(
    questionId: string,
    variable: string,
    search: string
  ) {
    const tenantId = getContext()?.tenantId

    const variableOption = getQuestions().find(
      (q) => q.questionId === questionId
    )?.variableOptions[variable]
    // TODO make the typing here a bit nicer.
    if (
      tenantId &&
      variableOption &&
      typeof variableOption !== 'string' &&
      variableOption.type === 'SEARCH'
    ) {
      return variableOption.search(tenantId, search)
    }
    return []
  }
}

export function splitStringIntoSubstrings(input: string): string[] {
  const words = input.split(' ')
  const substrings: string[] = []

  for (let i = 0; i < words.length; i++) {
    substrings.push(words.slice(i).join(' '), words.slice(0, i + 1).join(' '))
  }

  return substrings
}
