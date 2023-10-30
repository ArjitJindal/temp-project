import { memoize } from 'lodash'
import { getUsers } from './users'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

const krsAndDrsScoreData: () => [KrsScore[], DrsScore[]] = memoize(() => {
  const krss: KrsScore[] = []
  const drss: DrsScore[] = []
  getUsers().forEach((user) => {
    if (user.krsScore) {
      krss.push(user.krsScore)
    }

    if (user.drsScore) {
      drss.push(user.drsScore)
    }
  })

  return [krss, drss]
})

export { krsAndDrsScoreData as data }
