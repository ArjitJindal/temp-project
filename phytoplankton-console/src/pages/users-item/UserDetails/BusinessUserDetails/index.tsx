import { UI_SETTINGS } from '../../ui-settings';
import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';

interface Props {
  user: InternalBusinessUser;
  uiSettings: typeof UI_SETTINGS;
  hideExpectedTransactionLimits?: boolean;
}

export default function BusinessUserDetails(props: Props) {
  const { user, uiSettings, hideExpectedTransactionLimits = false } = props;

  return (
    <>
      <Card.Root
        header={{
          title: uiSettings.cards.USER_DETAILS.title,
        }}
      >
        <UserDetails user={user} />
      </Card.Root>
      {!hideExpectedTransactionLimits && (
        <Card.Root
          header={{
            title: uiSettings.cards.EXPECTED_TRANSACTION_LIMITS.title,
          }}
        >
          <ExpectedTransactionLimits user={user} />
        </Card.Root>
      )}
      <Card.Root
        header={{
          title: uiSettings.cards.SHAREHOLDERS.title,
        }}
      >
        <Card.Section>
          {user.shareHolders && <PersonsTable persons={user.shareHolders} />}
        </Card.Section>
      </Card.Root>
      <Card.Root
        header={{
          title: uiSettings.cards.DIRECTORS.title,
        }}
      >
        <Card.Section>{user.directors && <PersonsTable persons={user.directors} />}</Card.Section>
      </Card.Root>
    </>
  );
}
