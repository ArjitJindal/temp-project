import { transactions } from './transactions'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'

const data: ArsScore[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  transactions.map((t) => {
    if (t.arsScore) {
      data.push(t.arsScore)
    }
  })
}

export { data, init }
