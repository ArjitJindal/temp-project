import * as Card from '@/components/ui/Card';
import UserDetails from '@/pages/transactions-item/UserDetails';
import { CaseTransaction } from '@/apis';
import TransactionInfoCard from '@/pages/case-management-item/TransactionCaseDetails/TransactionDetailsCard/TransactionInfoCard';
import { ExpandTabRef } from '@/pages/case-management-item/TransactionCaseDetails';

interface Props {
  transaction: CaseTransaction;
  reference?: React.Ref<ExpandTabRef>;
}

const TransactionDetailsCard = (props: Props) => {
  const { transaction, reference } = props;
  return (
    <Card.Root
      header={{
        title: 'Transaction Details',
      }}
      ref={reference}
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
};

export default TransactionDetailsCard;
