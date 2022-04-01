import dayjs from 'dayjs'
import * as t from 'io-ts'
import reporter from 'io-ts-reporters'
import { ConverterInterface } from '../converter-interface'
import { Transaction } from '@/@types/openapi-public/Transaction'

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

export const ShPaymentTransactionConverter: ConverterInterface<Transaction> = {
  getCsvParserOptions() {
    return { headers: true, skipLines: 13 }
  },
  validate(rawTransaction: ShPaymentTransaction): string[] {
    return reporter.report(ShPaymentTransaction.decode(rawTransaction))
  },
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
      timestamp: dayjs(rawTransaction['Input Date']).unix(),
      reference: rawTransaction['Reference No'],
      sendingAmountDetails: {
        transactionAmount: parseFloat(transactionAmount),
        transactionCurrency,
      },
      senderPaymentDetails: {
        method: 'BANK',
        name: {
          firstName: senderFirstName,
          lastName: senderLastName,
        },
        IBAN: rawTransaction['Debtor account'],
        BIC: rawTransaction['Debtor institution BIC'],
      },
      receiverPaymentDetails: {
        method: 'BANK',
        name: {
          firstName: receiverFirstName,
          lastName: receiverLastName,
        },
        IBAN: rawTransaction['Creditor account'],
        BIC: rawTransaction['Creditor institution BIC / code'],
      },
    }
  },
}
