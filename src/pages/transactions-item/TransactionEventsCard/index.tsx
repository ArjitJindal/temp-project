import React from 'react';
import { TransactionEvent } from '@/apis';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import { ExpandTabRef } from '@/pages/case-management-item/TransactionCaseDetails';

interface Props {
  events: Array<TransactionEvent>;
  reference?: React.Ref<ExpandTabRef>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function TransactionEventsCard(props: Props) {
  const { events, updateCollapseState } = props;
  return (
    <Card.Root
      header={{ title: 'Transaction Events', collapsedByDefault: true }}
      ref={props.reference}
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
