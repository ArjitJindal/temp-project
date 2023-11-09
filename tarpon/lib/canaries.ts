import { StackConstants } from './constants'

export const CANARIES: {
  [key: string]: {
    path: string
  }
} = {
  [StackConstants.PUBLIC_API_CANARY_TESTS_NAME]: {
    path: 'public-api-canary-tests',
  },
}
