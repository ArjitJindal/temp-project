import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';

interface Props {
  user: InternalBusinessUser;
  collapsedByDefault?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function BusinessUserDetails(props: Props) {
  const { user, collapsedByDefault, updateCollapseState } = props;

  return (
    <>
      <Card.Root
        header={{ title: 'User Details', collapsedByDefault: collapsedByDefault ?? true }}
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
