// todo: move this tags to common UI package
import _ from 'lodash';
import { PaymentMethod } from './payments';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';

export const paymethodOptions: { value: PaymentMethod; label: any }[] = [
  {
    value: 'CARD',
    label: <PaymentMethodTag paymentMethod="CARD" />,
  },
  {
    value: 'GENERIC_BANK_ACCOUNT',
    label: <PaymentMethodTag paymentMethod="GENERIC_BANK_ACCOUNT" />,
  },
  {
    value: 'UPI',
    label: <PaymentMethodTag paymentMethod="UPI" />,
  },
  {
    value: 'IBAN',
    label: <PaymentMethodTag paymentMethod="IBAN" />,
  },
  {
    value: 'WALLET',
    label: <PaymentMethodTag paymentMethod="WALLET" />,
  },
  {
    value: 'ACH',
    label: <PaymentMethodTag paymentMethod="ACH" />,
  },
  {
    value: 'SWIFT',
    label: <PaymentMethodTag paymentMethod="SWIFT" />,
  },
  {
    value: 'MPESA',
    label: <PaymentMethodTag paymentMethod="MPESA" />,
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
