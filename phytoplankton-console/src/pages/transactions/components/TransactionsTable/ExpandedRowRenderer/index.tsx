import React from 'react';
import ApprovalDetails from './RuleAndCaseDetails';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { InternalTransaction } from '@/apis';
import { useTransactionDetails } from '@/utils/api/transactions';

interface Props {
  transactionId: string;
  isPaymentApprovals: boolean;
}

export default function ExpandedRowRenderer(props: Props) {
  const { transactionId, isPaymentApprovals } = props;
  const queryResult = useTransactionDetails(transactionId);

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
