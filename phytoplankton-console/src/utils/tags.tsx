// todo: move this tags to common UI package
import _ from 'lodash';
import { getPaymentMethodTitle, PaymentMethod } from './payments';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';

export const paymethodOptions: { value: PaymentMethod; label: string }[] = [
  {
    value: 'CARD',
    label: getPaymentMethodTitle('CARD'),
  },
  {
    value: 'GENERIC_BANK_ACCOUNT',
    label: getPaymentMethodTitle('GENERIC_BANK_ACCOUNT'),
  },
  {
    value: 'UPI',
    label: getPaymentMethodTitle('UPI'),
  },
  {
    value: 'IBAN',
    label: getPaymentMethodTitle('IBAN'),
  },
  {
    value: 'WALLET',
    label: getPaymentMethodTitle('WALLET'),
  },
  {
    value: 'ACH',
    label: getPaymentMethodTitle('ACH'),
  },
  {
    value: 'SWIFT',
    label: getPaymentMethodTitle('SWIFT'),
  },
  {
    value: 'MPESA',
    label: getPaymentMethodTitle('MPESA'),
  },
];

export const transactionType: { value: string; label: any }[] = [
  {
    value: 'DEPOSIT',
    label: <TransactionTypeTag transactionType="DEPOSIT" />,
  },
  {
    value: 'EXTERNAL_PAYMENT',
    label: <TransactionTypeTag transactionType="EXTERNAL_PAYMENT" />,
  },
  {
    value: 'WITHDRAWAL',
    label: <TransactionTypeTag transactionType="WITHDRAWAL" />,
  },
  {
    value: 'TRANSFER',
    label: <TransactionTypeTag transactionType="TRANSFER" />,
  },
];

export function capitalizeWords(text: string): string {
  return _.startCase(_.toLower(text));
}
