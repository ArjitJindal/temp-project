/* eslint-disable @typescript-eslint/no-var-requires */

import { useRef } from 'react';
import { InternalTransaction } from '@/apis';
import UserDetails from '@/pages/transactions-item/UserDetails';
import * as Card from '@/components/ui/Card';

interface Props {
  transaction: InternalTransaction;
}

export default function SenderReceiverDetails(props: Props) {
  const { transaction } = props;
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <Card.Root>
        <Card.Section direction="horizontal">
          <UserDetails
            type="ORIGIN"
            user={transaction.originUser}
            userId={transaction.originUserId}
            amountDetails={transaction.originAmountDetails}
            paymentDetails={transaction.originPaymentDetails}
            deviceData={transaction.originDeviceData}
            currentRef={leftRef}
            otherRef={rightRef}
          />
          <UserDetails
            type="DESTINATION"
            user={transaction.destinationUser}
            userId={transaction.destinationUserId}
            amountDetails={transaction.destinationAmountDetails}
            paymentDetails={transaction.destinationPaymentDetails}
            deviceData={transaction.destinationDeviceData}
            currentRef={rightRef}
            otherRef={leftRef}
          />
        </Card.Section>
      </Card.Root>
    </>
  );
}
