import { ColumnDataType } from '@/components/library/Table/types';
import { PaymentDetails } from '@/utils/api/payment-details';
import PaymentDetailsProps from '@/components/ui/PaymentDetailsProps';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';

export const PAYMENT_DETAILS_OR_METHOD = (
  showDetailsView: boolean,
): ColumnDataType<PaymentDetails> => ({
  stringify: (value) => {
    return `${value?.method}`;
  },
  defaultWrapMode: 'WRAP',
  render: (value) => {
    if (showDetailsView) {
      return <PaymentDetailsProps paymentDetails={value} />;
    }
    return <PaymentMethodTag paymentMethod={value?.method} />;
  },
});
