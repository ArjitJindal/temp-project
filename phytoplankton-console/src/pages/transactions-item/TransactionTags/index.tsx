import React from 'react';
import { InternalTransaction, Tag as ApiTag } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
interface Props {
  transaction: InternalTransaction;
}

export default function TransactionTags(props: Props) {
  const { transaction } = props;

  const getColumns = (tagsCount: number) => {
    if (tagsCount < 10) {
      return 1;
    }
    if (tagsCount < 30) {
      return 2;
    }
    return 3;
  };

  const getColumnTemplate = (tagsCount: number) => {
    const columns = getColumns(tagsCount);
    return Array(columns).fill('min-content auto').join(' ');
  };

  return (
    <EntityInfoGrid.Root>
      <EntityInfoGrid.Cell>
        <EntityPropertiesCard
          title={`Tags (${transaction.tags?.length ?? 0})`}
          items={
            transaction.tags?.map((tag: ApiTag) => ({ label: tag.key, value: tag.value })) ?? []
          }
          columnTemplate={getColumnTemplate(transaction.tags?.length ?? 0)}
        />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
