import { Alert } from 'antd';
import { UI_SETTINGS } from './ui-settings';
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
import { useApiTime, usePageViewTracker } from '@/utils/tracker';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
  updateCollapseState: (key: string, value: boolean) => void;
  onReload: () => void;
}

function TransactionCaseDetails(props: Props) {
  usePageViewTracker('Transaction Case Details');
  const { caseItem, onCaseUpdate, updateCollapseState } = props;
  const api = useApi();
  const measure = useApiTime();

  const caseId = caseItem.caseId as string;
  const transactionsResponse = useQuery(CASES_ITEM_TRANSACTIONS(caseId, {}), async () => {
    return await measure(
      () =>
        api.getCaseTransactions({
          caseId,
          pageSize: 1,
          includeUsers: true,
        }),
      'Get Case Transactions',
    );
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
            <TransactionDetailsCard
              transaction={transaction}
              updateCollapseState={updateCollapseState}
            />
            <RulesHitCard
              rulesHit={transaction.hitRules}
              updateCollapseState={updateCollapseState}
            />
            <TransactionEventsCard
              events={transaction.events ?? []}
              updateCollapseState={updateCollapseState}
            />
            <UserDetailsCard
              title={UI_SETTINGS.cards.ORIGIN_USER_DETAILS.title}
              user={transaction.originUser}
              updateCollapseState={updateCollapseState}
              collapsableKey={UI_SETTINGS.cards.ORIGIN_USER_DETAILS.key}
              onReload={props.onReload}
            />
            <UserDetailsCard
              title={UI_SETTINGS.cards.DESTINATION_USER_DETAILS.title}
              user={transaction.destinationUser}
              updateCollapseState={updateCollapseState}
              collapsableKey={UI_SETTINGS.cards.DESTINATION_USER_DETAILS.key}
              onReload={props.onReload}
            />
            <CommentsCard
              id={caseItem.caseId}
              comments={caseItem.comments ?? []}
              onCommentsUpdate={(newComments) => {
                onCaseUpdate({ ...caseItem, comments: newComments });
              }}
              updateCollapseState={updateCollapseState}
              onReload={props.onReload}
              commentType={'CASE'}
              collapsableKey={UI_SETTINGS.cards.COMMENTS.key}
              title={UI_SETTINGS.cards.COMMENTS.title}
            />
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
}

export default TransactionCaseDetails;
