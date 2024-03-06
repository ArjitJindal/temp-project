import { uniq } from 'lodash'
import {
  getQueries,
  getQuestions,
} from '@/services/copilot/questions/definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { prompt } from '@/utils/openai'
import { QuestionVariable } from '@/@types/openapi-internal/QuestionVariable'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { getContext } from '@/core/utils/context'

const MAX_DISTANCE = 2
const LIMIT = 30

@traceable
export class AutocompleteService {
  private phrases: string[] = getQuestions().map((q) =>
    q.questionId.toLowerCase()
  )

  autocomplete(query: string, c?: Case | null): string[] {
    query = query.toLowerCase()
    const prefixResults: string[] = []
    const results: { phrase: string; distance: number }[] = []

    const user = c?.caseUsers?.origin || c?.caseUsers?.destination
    const userCategory = user
      ? isBusinessUser(user as InternalUser)
        ? 'BUSINESS'
        : 'CONSUMER'
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
        if (!userCategory) return true
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

  public async interpretQuestion(questionPrompt: string): Promise<
    {
      questionId: string
      variables: QuestionVariable[]
    }[]
  > {
    try {
      const response = await prompt(
        [
          {
            role: 'system',
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
            )}
            You will be asked a to provide an array of questionId's and their corresponding "variables" based on user input. If no time range is specified, don't include "from" and "to" variables. If you aren't able to determine any other variable, don't include it in the response either.`,
          },
          {
            role: 'system',
            content: `Today's date is ${dayjs().format(
              'YYYY-MM-DD'
            )}. You will communicate dates in the same format.`,
          },
          {
            role: 'system',
            content: `You must reply with valid, iterable RFC8259 compliant JSON in your responses with the following structure as defined in typescript:
{
  questionId: string,
  variables: { name: string, value: any }[]
}[]`,
          },
          {
            role: 'assistant',
            content: `Please parse "${questionPrompt}" to give the best matching questionId and variables.`,
          },
        ],
        {
          temperature: 0.6,
          frequency_penalty: 0.15,
          presence_penalty: 0.15,
          top_p: 0.95,
        }
      )
      const results: {
        questionId: string
        variables: QuestionVariable[]
      }[] = JSON.parse(response.replace('```json', '').replace('```', ''))
      if (!Array.isArray(results) || results.length === 0) {
        logger.error('AI could not determine a relevant question', results)
        return []
      }
      return results
    } catch (e) {
      logger.error('Failed to parse JSON in reseponse from GPT', e)
      return []
    }
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
