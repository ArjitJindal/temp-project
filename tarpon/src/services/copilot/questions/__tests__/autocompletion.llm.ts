import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import { sortBy } from 'lodash'
import { AutocompleteService } from '@/services/copilot/questions/autocompletion-service'
import { QuestionVariable } from '@/@types/openapi-internal/QuestionVariable'
import dayjs from '@/utils/dayjs'
describe('Autocompletion interpretQuestion', () => {
  const ac = new AutocompleteService()
  const testCases: {
    prompt: string
    expectError?: boolean
    questions?: {
      questionId: QuestionId
      variables: QuestionVariable[]
    }[]
  }[] = [
    {
      prompt: 'users transactions',
      questions: [
        {
          questionId: COPILOT_QUESTIONS.USER_TRANSACTIONS,
          variables: [],
        },
      ],
    },
    {
      prompt: 'transactions for the last 10 days',
      questions: [
        {
          questionId: COPILOT_QUESTIONS.TRANSACTIONS,
          variables: [
            {
              name: 'from',
              value: dayjs().subtract(10, 'd').format('YYYY-MM-DD'),
            },
            { name: 'to', value: dayjs().format('YYYY-MM-DD') },
          ],
        },
      ],
    },
    // {
    //   prompt: 'cases and allerts for the last two months',
    //   questions: [
    //     {
    //       questionId: COPILOT_QUESTIONS.CASES,
    //       variables: [
    //         {
    //           name: 'from',
    //           value: dayjs().subtract(2, 'M').format('YYYY-MM-DD'),
    //         },
    //         { name: 'to', value: dayjs().format('YYYY-MM-DD') },
    //       ],
    //     },
    //     {
    //       questionId: COPILOT_QUESTIONS.ALERTS,
    //       variables: [
    //         {
    //           name: 'from',
    //           value: dayjs().subtract(2, 'M').format('YYYY-MM-DD'),
    //         },
    //         { name: 'to', value: dayjs().format('YYYY-MM-DD') },
    //       ],
    //     },
    //   ],
    // },
    // {
    //   prompt:
    //     'I also wanna seee their directors and any other details about the user',
    //   questions: [
    //     {
    //       questionId: COPILOT_QUESTIONS.DIRECTORS,
    //       variables: [],
    //     },
    //     {
    //       questionId: COPILOT_QUESTIONS.USER_DETAILS,
    //       variables: [],
    //     },
    //   ],
    // },
    {
      prompt: 'Show me how the TRS score changes over time',
      questions: [
        {
          questionId: COPILOT_QUESTIONS.TRS_SCORE,
          variables: [],
        },
      ],
    },
    {
      prompt: 'transactions insights',
      questions: [
        {
          questionId: COPILOT_QUESTIONS.TRANSACTION_INSIGHTS,
          variables: [],
        },
      ],
    },
    // {
    //   prompt: 'show transactions for the last 65 days',
    //   questions: [
    //     {
    //       questionId: COPILOT_QUESTIONS.USER_TRANSACTIONS,
    //       variables: [
    //         {
    //           name: 'from',
    //           value: dayjs().subtract(66, 'd').format('YYYY-MM-DD'),
    //         },
    //         { name: 'to', value: dayjs().format('YYYY-MM-DD') },
    //       ],
    //     },
    //   ],
    // },
  ]

  testCases.forEach((tc) => {
    test(`Interpret "${tc.prompt}"`, async () => {
      const questions = await ac.interpretQuestionWithGPT(tc.prompt)
      expect(sortBy(questions, 'questionId')).toEqual(
        sortBy(tc.questions, 'questionId')
      )
    })
  })
})
