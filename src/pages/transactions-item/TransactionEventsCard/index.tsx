import { TransactionEvent } from '@/apis';
import * as Card from '@/components/ui/Card';
import { UI_SETTINGS } from '@/pages/case-management-item/TransactionCaseDetails/ui-settings';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';

interface Props {
  events: Array<TransactionEvent>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function TransactionEventsCard(props: Props) {
  const { events, updateCollapseState } = props;
  return (
    <Card.Root
      header={{
        title: UI_SETTINGS.cards.TRANSACTION_EVENTS.title,
        collapsableKey: UI_SETTINGS.cards.TRANSACTION_EVENTS.key,
      }}
      updateCollapseState={updateCollapseState}
    >
      <Card.Section>
        <TransactionEventsTable events={events} />
      </Card.Section>
    </Card.Root>
  );
}
