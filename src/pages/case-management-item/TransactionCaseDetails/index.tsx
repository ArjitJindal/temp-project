import { forwardRef, Ref, useImperativeHandle, useRef } from 'react';
import { Alert } from 'antd';
import TransactionDetailsCard from '@/pages/case-management-item/TransactionCaseDetails/TransactionDetailsCard';
import RulesHitCard from '@/pages/case-management-item/TransactionCaseDetails/RulesHitCard';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import UserDetailsCard from '@/pages/case-management-item/TransactionCaseDetails/UserDetailsCard';
import CommentsCard from '@/pages/case-management-item/components/CommentsCard';
import { Case } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM_TRANSACTIONS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';
import { ExpandTabsRef } from '@/pages/case-management-item';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
  onReload: () => void;
}

export interface ExpandTabRef {
  expand: () => void;
}

function TransactionCaseDetails(props: Props, ref: Ref<ExpandTabsRef>) {
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

  const transactionDetailsCardRef = useRef<ExpandTabRef>(null);
  const rulesHitCardRef = useRef<ExpandTabRef>(null);
  const transactionEventsCardRef = useRef<ExpandTabRef>(null);
  const originUserDetailsCardRef = useRef<ExpandTabRef>(null);
  const destinationUserDetailsCardRef = useRef<ExpandTabRef>(null);
  const commentsCardRef = useRef<ExpandTabRef>(null);

  useImperativeHandle(ref, () => ({
    expand: () => {
      transactionDetailsCardRef.current?.expand();
      rulesHitCardRef.current?.expand();
      transactionEventsCardRef.current?.expand();
      originUserDetailsCardRef.current?.expand();
      destinationUserDetailsCardRef.current?.expand();
      commentsCardRef.current?.expand();
    },
  }));

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
            <TransactionDetailsCard
              transaction={transaction}
              reference={transactionDetailsCardRef}
            />
            <RulesHitCard rulesHit={transaction.hitRules} reference={rulesHitCardRef} />
            <TransactionEventsCard
              events={transaction.events ?? []}
              reference={transactionEventsCardRef}
            />
            <UserDetailsCard
              title="Origin (Sender) User Details"
              user={transaction.originUser}
              reference={originUserDetailsCardRef}
            />
            <UserDetailsCard
              title="Destination (Receiver) User Details"
              user={transaction.destinationUser}
              reference={destinationUserDetailsCardRef}
            />
            <CommentsCard
              caseId={caseItem.caseId}
              caseStatus={caseItem.caseStatus}
              comments={caseItem.comments ?? []}
              onCommentsUpdate={(newComments) => {
                onCaseUpdate({ ...caseItem, comments: newComments });
              }}
              reference={commentsCardRef}
              onReload={props.onReload}
            />
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
}

export default forwardRef(TransactionCaseDetails);
