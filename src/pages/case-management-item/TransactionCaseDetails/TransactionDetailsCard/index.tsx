import * as Card from '@/components/ui/Card';
import UserDetails from '@/pages/transactions-item/UserDetails';
import { CaseTransaction } from '@/apis';
import TransactionInfoCard from '@/pages/case-management-item/TransactionCaseDetails/TransactionDetailsCard/TransactionInfoCard';

interface Props {
  transaction: CaseTransaction;
}

export default function TransactionDetailsCard(props: Props) {
  const { transaction } = props;
  return (
    <Card.Root
      header={{
        title: 'Transaction Details',
      }}
    >
      <Card.Section direction="horizontal" align="start">
        <TransactionInfoCard transaction={transaction} />
        <UserDetails
          type="ORIGIN"
          user={transaction.originUser}
          userId={transaction.originUserId}
          amountDetails={transaction.originAmountDetails}
          paymentDetails={transaction.originPaymentDetails}
        />
        <UserDetails
          type="DESTINATION"
          user={transaction.destinationUser}
          userId={transaction.destinationUserId}
          amountDetails={transaction.destinationAmountDetails}
          paymentDetails={transaction.destinationPaymentDetails}
        />
      </Card.Section>
    </Card.Root>
  );
}
