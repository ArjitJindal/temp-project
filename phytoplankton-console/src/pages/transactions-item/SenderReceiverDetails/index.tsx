/* eslint-disable @typescript-eslint/no-var-requires */

import { InternalTransaction } from '@/apis';
import UserDetails from '@/pages/transactions-item/UserDetails';
import * as Card from '@/components/ui/Card';

interface Props {
  transaction: InternalTransaction;
}

export default function SenderReceiverDetails(props: Props) {
  const { transaction } = props;
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
            ipAddress={transaction.originDeviceData?.ipAddress}
          />
          <UserDetails
            type="DESTINATION"
            user={transaction.destinationUser}
            userId={transaction.originUserId}
            amountDetails={transaction.destinationAmountDetails}
            paymentDetails={transaction.destinationPaymentDetails}
            ipAddress={transaction.destinationDeviceData?.ipAddress}
          />
        </Card.Section>
      </Card.Root>
    </>
  );
}
