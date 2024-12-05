import React from 'react';
import ApprovalDetails from './RuleAndCaseDetails';
import { useApi } from '@/api';
import { TRANSACTIONS_ITEM } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { InternalTransaction } from '@/apis';

interface Props {
  transactionId: string;
}

export default function ExpandedRowRenderer(props: Props) {
  const { transactionId } = props;
  const api = useApi();
  const queryResult = useQuery(TRANSACTIONS_ITEM(transactionId), () =>
    api.getTransaction({ transactionId }),
  );

  return (
    <AsyncResourceRenderer<InternalTransaction> resource={queryResult.data}>
      {(transaction) => {
        return <ApprovalDetails transaction={transaction} action={'SUSPEND'} />;
      }}
    </AsyncResourceRenderer>
  );
}
