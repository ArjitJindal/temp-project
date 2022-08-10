import { PaymentMethodTag } from '../pages/case-management/components/PaymentTypeTag';

export const paymentMethod: { value: string; label: any }[] = [
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
];
