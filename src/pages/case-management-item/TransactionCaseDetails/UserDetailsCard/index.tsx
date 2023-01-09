import * as Card from '@/components/ui/Card';
import UserDetails from '@/pages/users-item/UserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import UserIdNameCard from '@/components/ui/UserIdNameCard';
import { UI_SETTINGS } from '@/pages/users-item/ui-settings';

interface Props {
  title: string;
  user: InternalConsumerUser | InternalBusinessUser | MissingUser | undefined;
  updateCollapseState?: (key: string, value: boolean) => void;
  collapsableKey: string;
  onReload: () => void;
}

export default function UserDetailsCard(props: Props) {
  const { title, user, updateCollapseState, collapsableKey } = props;

  return (
    <Card.Root
      disabled={user == null || !('type' in user)}
      header={{ title, collapsableKey }}
      updateCollapseState={updateCollapseState}
    >
      <Card.Section>
        <UserIdNameCard user={user} showRiskLevel={true} />
      </Card.Section>
      <Card.Section>
        <UserDetails
          user={user}
          isEmbedded={true}
          onReload={props.onReload}
          showCommentEditor={false}
          uiSettings={UI_SETTINGS}
        />
      </Card.Section>
    </Card.Root>
  );
}
