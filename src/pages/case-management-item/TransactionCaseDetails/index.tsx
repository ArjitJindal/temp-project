import { forwardRef, Ref, useImperativeHandle, useRef } from 'react';
import { Alert } from 'antd';
import TransactionDetailsCard from '@/pages/case-management-item/TransactionCaseDetails/TransactionDetailsCard';
import RulesHitCard from '@/pages/case-management-item/TransactionCaseDetails/RulesHitCard';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import UserDetailsCard from '@/pages/case-management-item/TransactionCaseDetails/UserDetailsCard';
import CommentsCard from '@/components/CommentsCard';
import { Case } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM_TRANSACTIONS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';
import { ExpandTabsRef } from '@/pages/case-management-item';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
  updateCollapseState: (key: string, value: boolean) => void;
  onReload: () => void;
}

export interface ExpandTabRef {
  expand: (shouldExpand?: boolean) => void;
}

function TransactionCaseDetails(props: Props, ref: Ref<ExpandTabsRef>) {
  const { caseItem, onCaseUpdate, updateCollapseState } = props;
  const api = useApi();

  const caseId = caseItem.caseId as string;
  const transactionsResponse = useQuery(CASES_ITEM_TRANSACTIONS(caseId, {}), async () => {
    return await api.getCaseTransactions({
      caseId,
      pageSize: 1,
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
    expand: (shouldExpand) => {
      transactionDetailsCardRef.current?.expand(shouldExpand);
      rulesHitCardRef.current?.expand(shouldExpand);
      transactionEventsCardRef.current?.expand(shouldExpand);
      originUserDetailsCardRef.current?.expand(shouldExpand);
      destinationUserDetailsCardRef.current?.expand(shouldExpand);
      commentsCardRef.current?.expand(shouldExpand);
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
              updateCollapseState={updateCollapseState}
            />
            <RulesHitCard
              rulesHit={transaction.hitRules}
              reference={rulesHitCardRef}
              updateCollapseState={updateCollapseState}
            />
            <TransactionEventsCard
              events={transaction.events ?? []}
              reference={transactionEventsCardRef}
              updateCollapseState={updateCollapseState}
            />
            <UserDetailsCard
              title="Origin (Sender) User Details"
              user={transaction.originUser}
              reference={originUserDetailsCardRef}
              updateCollapseState={updateCollapseState}
              collapseKey="originUserDetails"
              onReload={props.onReload}
            />
            <UserDetailsCard
              title="Destination (Receiver) User Details"
              user={transaction.destinationUser}
              reference={destinationUserDetailsCardRef}
              updateCollapseState={updateCollapseState}
              collapseKey="destinationUserDetails"
              onReload={props.onReload}
            />
            <CommentsCard
              id={caseItem.caseId}
              caseStatus={caseItem.caseStatus}
              comments={caseItem.comments ?? []}
              onCommentsUpdate={(newComments) => {
                onCaseUpdate({ ...caseItem, comments: newComments });
              }}
              reference={commentsCardRef}
              updateCollapseState={updateCollapseState}
              onReload={props.onReload}
              commentType={'CASE'}
            />
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
}

export default forwardRef(TransactionCaseDetails);
