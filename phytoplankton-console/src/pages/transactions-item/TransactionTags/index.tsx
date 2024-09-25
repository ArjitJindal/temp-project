import React from 'react';
import { InternalTransaction, Tag as ApiTag } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';

interface Props {
  transaction: InternalTransaction;
}

export default function TransactionTags(props: Props) {
  const { transaction } = props;
  return (
    <EntityInfoGrid.Root>
      <EntityInfoGrid.Cell>
        <EntityPropertiesCard
          title={`Tags (${transaction.tags?.length ?? 0})`}
          items={
            transaction.tags?.map((tag: ApiTag) => ({ label: tag.key, value: tag.value })) ?? []
          }
          columns={2}
        />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
