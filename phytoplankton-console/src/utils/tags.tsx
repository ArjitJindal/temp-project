// todo: move this tags to common UI package
import _ from 'lodash';
import { getPaymentMethodTitle } from './payments';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { TRANSACTION_TYPES } from '@/apis/models-custom/TransactionType';
import { PAYMENT_METHODS } from '@/apis/models-custom/PaymentMethod';

export const paymethodOptions = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: getPaymentMethodTitle(method),
}));

export const transactionType = TRANSACTION_TYPES.map((type) => ({
  value: type,
  label: <TransactionTypeTag transactionType={type} />,
}));

export function capitalizeWords(text: string): string {
  return _.startCase(_.toLower(text));
}
