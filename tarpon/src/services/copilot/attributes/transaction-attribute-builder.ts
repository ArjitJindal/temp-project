import { AttributeBuilder, BuilderKey, InputData } from './builder'
import { AttributeSet } from './attribute-set'
import dayjs from '@/utils/dayjs'
import { getContext } from '@/core/utils/context'
import { getUserName } from '@/utils/helpers'

export class CurrentTransactionBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return []
  }

  build(attributes: AttributeSet, inputData: InputData): void {
    const currentTransaction = inputData.currentTransaction
    if (!currentTransaction) {
      return
    }
    if (!attributes.getAttribute('transactionIds')) {
      attributes.setAttribute('transactionIds', [
        currentTransaction.transactionId,
      ])
    }
    const tenantTimezone = getContext()?.settings?.defaultValues?.tenantTimezone
    attributes.setAttribute(
      'originUserName',
      getUserName(currentTransaction.originUser)
    )
    attributes.setAttribute(
      'destinationUserName',
      getUserName(currentTransaction.destinationUser)
    )

    attributes.setAttribute(
      'originTransactionAmount',
      currentTransaction.originAmountDetails?.transactionAmount
    )
    attributes.setAttribute(
      'destinationTransactionAmount',
      currentTransaction.destinationAmountDetails?.transactionAmount
    )
    attributes.setAttribute(
      'originTransactionCurrency',
      currentTransaction.originAmountDetails?.transactionCurrency
    )
    attributes.setAttribute(
      'destinationTransactionCurrency',
      currentTransaction.destinationAmountDetails?.transactionCurrency
    )
    attributes.setAttribute(
      'originTransactionCountry',
      currentTransaction.originAmountDetails?.country
    )
    attributes.setAttribute(
      'destinationTransactionCountry',
      currentTransaction.destinationAmountDetails?.country
    )
    attributes.setAttribute(
      'originPaymentDetails',
      currentTransaction.originPaymentDetails
    )
    attributes.setAttribute(
      'destinationPaymentDetails',
      currentTransaction.destinationPaymentDetails
    )
    attributes.setAttribute(
      'timeOfTransaction',
      dayjs(currentTransaction.timestamp)
        .tz(tenantTimezone)
        .format('DD/MM/YYYY HH:mm:ss')
    )
    attributes.setAttribute(
      'transactionReference',
      currentTransaction.reference
    )
  }
}
