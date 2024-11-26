import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';

interface Props {
  transactionId: string;
}

export default function TransactionEventsCard(props: Props) {
  const { transactionId } = props;
  return (
    <Card.Root>
      <Card.Section>
        <TransactionEventsTable transactionId={transactionId} />
      </Card.Section>
    </Card.Root>
  );
}
