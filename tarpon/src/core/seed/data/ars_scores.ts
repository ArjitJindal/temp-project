import { memoize } from 'lodash'
import { getTransactions } from './transactions'
import { getUsers } from './users'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'

export const getArsScores: () => ArsScore[] = memoize(() => {
  return getTransactions().map((t) => {
    return t.arsScore as ArsScore
  })
})

export const getKrsScores: () => KrsScore[] = memoize(() => {
  return getUsers().map((u) => {
    return u.krsScore as KrsScore
  })
})

export const getDrsScores: () => DrsScore[] = memoize(() => {
  return getUsers().map((u) => {
    return u.drsScore as DrsScore
  })
})
