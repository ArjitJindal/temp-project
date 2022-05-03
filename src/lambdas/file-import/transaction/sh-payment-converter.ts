import dayjs from 'dayjs'
import * as t from 'io-ts'
import reporter from 'io-ts-reporters'
import { MongoClient } from 'mongodb'
import { ConverterInterface } from '../converter-interface'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { UserRepository } from '@/services/users/repositories/user-repository'

const ShPaymentTransaction = t.type({
  No: t.string,
  Direction: t.union([t.literal('IN'), t.literal('OUT')]),
  'Input Date': t.string,
  'Reference No': t.string,
  Amount: t.string,
  'Debtor name': t.string,
  'Debtor account': t.string,
  'Debtor institution BIC': t.string,
  'Creditor name': t.string,
  'Creditor account': t.string,
  'Creditor institution BIC / code': t.string,
})
type ShPaymentTransaction = t.TypeOf<typeof ShPaymentTransaction>

export class ShPaymentTransactionConverter
  implements ConverterInterface<Transaction>
{
  accountToUserId: { [key: string]: string } = {}

  async initialize(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
    }
  ): Promise<void> {
    const userRepository = new UserRepository(tenantId, {
      mongoDb: connections.mongoDb,
    })
    const allBusinessUsers = await userRepository.getBusinessUsers({
      limit: Infinity,
      skip: 0,
      beforeTimestamp: Infinity,
    })
    allBusinessUsers.data.forEach((user) => {
      const account = user.tags?.filter((tag) => tag.key === 'Account')[0].value
      if (account) {
        this.accountToUserId[account] = user.userId
      }
    })
    return
  }
  getCsvParserOptions() {
    return { headers: true }
  }
  validate(rawTransaction: ShPaymentTransaction): string[] {
    return reporter.report(ShPaymentTransaction.decode(rawTransaction))
  }
  convert(rawTransaction: ShPaymentTransaction): Transaction | null {
    const direction = rawTransaction.Direction
    if (direction === 'IN') {
      // We don't handle it for now as it's a meta transaction without transaction amount
      // and sender/receiver info.
      return null
    }

    const [transactionAmount, transactionCurrency] =
      rawTransaction.Amount.split(' ')
    const [senderFirstName, senderLastName] =
      rawTransaction['Debtor name'].split(' ')
    const [receiverFirstName, receiverLastName] =
      rawTransaction['Creditor name'].split(' ')
    return {
      transactionId: rawTransaction.No,
      timestamp: dayjs(rawTransaction['Input Date']).valueOf(),
      reference: rawTransaction['Reference No'],
      originUserId: this.accountToUserId[rawTransaction['Debtor account']],
      destinationUserId:
        this.accountToUserId[rawTransaction['Creditor account']],
      originAmountDetails: {
        transactionAmount: parseFloat(transactionAmount),
        transactionCurrency,
      },
      originPaymentDetails: {
        method: 'IBAN',
        name: {
          firstName: senderFirstName,
          lastName: senderLastName,
        },
        IBAN: rawTransaction['Debtor account'],
        BIC: rawTransaction['Debtor institution BIC'],
      },
      destinationPaymentDetails: {
        method: 'IBAN',
        name: {
          firstName: receiverFirstName,
          lastName: receiverLastName,
        },
        IBAN: rawTransaction['Creditor account'],
        BIC: rawTransaction['Creditor institution BIC / code'],
      },
    }
  }
}
