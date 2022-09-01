import React from 'react';
import { TransactionEvent } from '@/apis';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';

interface Props {
  events: Array<TransactionEvent>;
}

export default function TransactionEventsCard(props: Props) {
  const { events } = props;
  return (
    <Card.Root>
      <Card.Section>
        <Card.Title>Transaction Events</Card.Title>
      </Card.Section>
      <Card.Section>
        <TransactionEventsTable events={events} />
      </Card.Section>
    </Card.Root>
  );
}
