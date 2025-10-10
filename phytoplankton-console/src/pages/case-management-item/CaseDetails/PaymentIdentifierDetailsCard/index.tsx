import React from 'react';
import PaymentDetailsProps from 'src/components/ui/PaymentDetailsProps';
import * as Card from '@/components/ui/Card';
import { PaymentDetails } from '@/utils/api/payment-details';

interface Props {
  paymentDetails: PaymentDetails | undefined;
}

export default function PaymentIdentifierDetailsCard(props: Props) {
  const { paymentDetails } = props;

  return (
    <Card.Root>
      <Card.Section>
        <PaymentDetailsProps paymentDetails={paymentDetails} />
      </Card.Section>
    </Card.Root>
  );
}
