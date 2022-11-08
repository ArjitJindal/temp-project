import React from 'react';
import { TransactionEvent } from '@/apis';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import { ExpandTabRef } from '@/pages/case-management-item/TransactionCaseDetails';

interface Props {
  events: Array<TransactionEvent>;
  reference?: React.Ref<ExpandTabRef>;
}

export default function TransactionEventsCard(props: Props) {
  const { events } = props;
  return (
    <Card.Root
      header={{
        title: 'Transaction Events',
      }}
      ref={props.reference}
    >
      <Card.Section>
        <TransactionEventsTable events={events} />
      </Card.Section>
    </Card.Root>
  );
}
