import { memoize } from 'lodash'
import { getTransactions } from './transactions'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'

export const getArsScores: () => ArsScore[] = memoize(() => {
  return getTransactions().map((t) => {
    return t.arsScore as ArsScore
  })
})
