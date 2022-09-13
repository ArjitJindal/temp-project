/* eslint-disable @typescript-eslint/no-var-requires */

import { TransactionCaseManagement } from '@/apis';
import UserDetails from '@/pages/transactions-item/UserDetails';
import * as Card from '@/components/ui/Card';

interface Props {
  transaction: TransactionCaseManagement;
}

export default function SenderReceiverDetails(props: Props) {
  const { transaction } = props;
  return (
    <>
      <Card.Root
        header={{
          title: 'Origin (Sender) and Destination (Receiver) Details',
        }}
      >
        <Card.Section direction="horizontal">
          <UserDetails
            type="ORIGIN"
            user={transaction.originUser}
            amountDetails={transaction.originAmountDetails}
            paymentDetails={transaction.originPaymentDetails}
          />
          <UserDetails
            type="DESTINATION"
            user={transaction.destinationUser}
            amountDetails={transaction.destinationAmountDetails}
            paymentDetails={transaction.destinationPaymentDetails}
          />
        </Card.Section>
      </Card.Root>
    </>
  );
}
