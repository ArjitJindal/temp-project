import React from 'react';
import s from './index.module.less';
import { PaymentDetails } from '@/utils/api/payment-details';
import PaymentDetailsProps from '@/components/ui/PaymentDetailsProps';
import ExpandContainer from '@/components/utils/ExpandContainer';
import { getPaymentMethodTitle, getPaymentDetailsIdString } from '@/utils/payments';
import ExpandIcon from '@/components/library/ExpandIcon';

interface Props {
  paymentDetails: PaymentDetails;
  isExpanded: boolean;
  onExpandChange: (value: boolean) => void;
}

export default function PaymentDetailsCard(prop: Props) {
  const { paymentDetails, isExpanded, onExpandChange } = prop;

  return (
    <div className={s.root}>
      <div
        className={s.header}
        onClick={() => {
          onExpandChange(!isExpanded);
        }}
      >
        <ExpandIcon isExpanded={isExpanded} color="BLACK" />
        <div>{getPaymentMethodTitle(paymentDetails.method)}</div>
        <div className={s.paymentDetailsId}>{getPaymentDetailsIdString(paymentDetails)}</div>
      </div>
      <ExpandContainer isCollapsed={!isExpanded}>
        <div className={s.body}>
          <PaymentDetailsProps paymentDetails={paymentDetails} />
        </div>
      </ExpandContainer>
    </div>
  );
}
