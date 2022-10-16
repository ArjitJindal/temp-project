import React from 'react';
import { Alert } from 'antd';
import TransactionDetailsCard from '@/pages/case-management-item/components/TransactionDetailsCard';
import RulesHitCard from '@/pages/case-management-item/components/RulesHitCard';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import UserDetailsCard from '@/pages/case-management-item/components/UserDetailsCard';
import CommentsCard from '@/pages/case-management-item/components/CommentsCard';
import { Case } from '@/apis';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
}

export default function TransactionCaseDetails(props: Props) {
  const { caseItem, onCaseUpdate } = props;
  if (caseItem.caseTransactions == null || caseItem.caseTransactions.length === 0) {
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
  if (caseItem.caseTransactions.length > 1) {
    console.warn('Case have more than one transaction, it is not supported for a moment');
  }
  const [transaction] = caseItem.caseTransactions;
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
}
