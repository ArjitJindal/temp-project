import { UI_SETTINGS } from '../../ui-settings';
import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';

interface Props {
  user: InternalBusinessUser;
  updateCollapseState?: (key: string, value: boolean) => void;
  uiSettings: typeof UI_SETTINGS;
}

export default function BusinessUserDetails(props: Props) {
  const { user, updateCollapseState, uiSettings } = props;

  return (
    <>
      <Card.Root
        header={{
          title: uiSettings.cards.USER_DETAILS.title,
          collapsableKey: uiSettings.cards.USER_DETAILS.key,
        }}
        updateCollapseState={updateCollapseState}
      >
        <UserDetails user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: uiSettings.cards.EXPECTED_TRANSACTION_LIMITS.title,
          collapsableKey: uiSettings.cards.EXPECTED_TRANSACTION_LIMITS.key,
        }}
      >
        <ExpectedTransactionLimits user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: uiSettings.cards.SHAREHOLDERS.title,
          collapsableKey: uiSettings.cards.SHAREHOLDERS.key,
        }}
        updateCollapseState={updateCollapseState}
      >
        {user.shareHolders && user.shareHolders.length > 0 && (
          <PersonsTable persons={user.shareHolders} />
        )}
      </Card.Root>
      <Card.Root
        header={{
          title: uiSettings.cards.DIRECTORS.title,
          collapsableKey: uiSettings.cards.DIRECTORS.key,
        }}
        updateCollapseState={updateCollapseState}
      >
        {user.directors && user.directors.length > 0 && <PersonsTable persons={user.directors} />}
      </Card.Root>
    </>
  );
}
