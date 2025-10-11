import React from 'react';
import ApprovalDetails from './RuleAndCaseDetails';
import { useTransactionItem } from '@/hooks/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { InternalTransaction } from '@/apis';

interface Props {
  transactionId: string;
  isPaymentApprovals: boolean;
}

export default function ExpandedRowRenderer(props: Props) {
  const { transactionId, isPaymentApprovals } = props;
  const queryResult = useTransactionItem(transactionId);

  return (
    <AsyncResourceRenderer<InternalTransaction> resource={queryResult.data}>
      {(transaction) => {
        return (
          <ApprovalDetails
            transaction={transaction}
            action={isPaymentApprovals ? 'SUSPEND' : undefined}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}
