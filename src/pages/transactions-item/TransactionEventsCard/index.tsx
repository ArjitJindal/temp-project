import { TransactionEvent } from '@/apis';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';

interface Props {
  events: Array<TransactionEvent>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function TransactionEventsCard(props: Props) {
  const { events, updateCollapseState } = props;
  return (
    <Card.Root
      header={{ title: 'Transaction Events', collapsedByDefault: true }}
      onCollapseChange={(isCollapsed) => {
        if (updateCollapseState) {
          updateCollapseState('transactionEvents', isCollapsed);
        }
      }}
    >
      <Card.Section>
        <TransactionEventsTable events={events} />
      </Card.Section>
    </Card.Root>
  );
}
