import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';

interface Props {
  user: InternalBusinessUser;
  collapsedByDefault?: boolean;
  userDetailsRef?: React.Ref<ExpandTabRef>;
  expectedTransactionsRef?: React.Ref<ExpandTabRef>;
  shareHoldersRef?: React.Ref<ExpandTabRef>;
  dierctorsRef?: React.Ref<ExpandTabRef>;
  documentsRef?: React.Ref<ExpandTabRef>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function BusinessUserDetails(props: Props) {
  const { user, collapsedByDefault, updateCollapseState } = props;

  return (
    <>
      <Card.Root
        header={{ title: 'User Details', collapsedByDefault: collapsedByDefault ?? true }}
        ref={props.userDetailsRef}
        onCollapseChange={(isCollapsed) => {
          if (updateCollapseState) {
            updateCollapseState('userDetails', isCollapsed);
          }
        }}
      >
        <UserDetails user={user} />
      </Card.Root>
      <Card.Root
        header={{ title: 'Expected Transaction Limits', collapsedByDefault }}
        ref={props.expectedTransactionsRef}
        onCollapseChange={(isCollapsed) => {
          if (updateCollapseState) {
            updateCollapseState('expectedTransactions', isCollapsed);
          }
        }}
      >
        <ExpectedTransactionLimits user={user} />
      </Card.Root>
      <Card.Root
        header={{ title: 'Shareholders', collapsedByDefault }}
        ref={props.shareHoldersRef}
        onCollapseChange={(isCollapsed) => {
          if (updateCollapseState) {
            updateCollapseState('shareHolders', isCollapsed);
          }
        }}
      >
        {user.shareHolders && user.shareHolders.length > 0 && (
          <PersonsTable persons={user.shareHolders} />
        )}
      </Card.Root>
      <Card.Root
        header={{ title: 'Directors', collapsedByDefault }}
        ref={props.dierctorsRef}
        onCollapseChange={(isCollapsed) => {
          if (updateCollapseState) {
            updateCollapseState('directors', isCollapsed);
          }
        }}
      >
        {user.directors && user.directors.length > 0 && <PersonsTable persons={user.directors} />}
      </Card.Root>
    </>
  );
}
