import React from 'react';
import { Alert } from 'antd';
import TransactionDetailsCard from '@/pages/case-management-item/components/TransactionDetailsCard';
import RulesHitCard from '@/pages/case-management-item/components/RulesHitCard';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import UserDetailsCard from '@/pages/case-management-item/components/UserDetailsCard';
import CommentsCard from '@/pages/case-management-item/components/CommentsCard';
import { Case } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM_TRANSACTIONS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
}

export default function TransactionCaseDetails(props: Props) {
  const { caseItem, onCaseUpdate } = props;
  const api = useApi();

  const caseId = caseItem.caseId as string;
  const transactionsResponse = useQuery(CASES_ITEM_TRANSACTIONS(caseId, {}), async () => {
    return await api.getCaseTransactions({
      caseId,
      limit: 1,
      skip: 0,
      includeUsers: true,
    });
  });

  if (caseItem.caseTransactionsIds && caseItem.caseTransactionsIds?.length > 1) {
    console.warn('Case have more than one transaction, it is not supported for a moment');
  }

  return (
    <AsyncResourceRenderer resource={transactionsResponse.data}>
      {(caseTransactions) => {
        if (caseTransactions.data.length === 0) {
          return (
            <Alert
              style={{
                margin: '1rem',
              }}
              type="error"
              description={
                <>
                  <p>
                    <b>No connected transaction</b>
                  </p>
                  <p>This is a transaction case, but it doesn't have connected transaction!</p>
                </>
              }
            />
          );
        }
        const [transaction] = caseTransactions.data;
        return (
          <>
            <TransactionDetailsCard transaction={transaction} />
            <RulesHitCard rulesHit={transaction.hitRules} />
            <TransactionEventsCard events={transaction.events ?? []} />
            <UserDetailsCard title="Origin (Sender) User Details" user={transaction.originUser} />
            <UserDetailsCard
              title="Destination (Receiver) User Details"
              user={transaction.destinationUser}
            />
            <CommentsCard
              caseId={caseItem.caseId}
              comments={caseItem.comments ?? []}
              onCommentsUpdate={(newComments) => {
                onCaseUpdate({ ...caseItem, comments: newComments });
              }}
            />
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
}
