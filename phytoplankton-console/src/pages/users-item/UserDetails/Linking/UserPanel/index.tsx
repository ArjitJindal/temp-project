import { UserCard } from '../UserCard';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { makeUrl } from '@/utils/routing';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useUserDetails } from '@/utils/api/users';
type UserPanelProps = {
  userId: string;
  followed: string[];
  onFollow: (userId: string) => void;
  isFollowEnabled: boolean;
};

export const UserPanel = (props: UserPanelProps) => {
  const settings = useSettings();
  const { followed, onFollow, userId, isFollowEnabled } = props;

  const queryResult = useUserDetails(userId);

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(user) => (
        <Card.Root>
          <Card.Section>
            <UserCard user={user} />
          </Card.Section>
          <Card.Section>
            <Button
              onClick={() =>
                window.open(
                  makeUrl(`/users/list/${user.type?.toLowerCase() || 'all'}/${user.userId}`),
                  '_blank',
                )
              }
            >
              Go to {settings.userAlias} details
            </Button>
            {!followed.includes(user.userId) && isFollowEnabled && (
              <Button type="SECONDARY" onClick={() => onFollow(user.userId)}>
                Follow
              </Button>
            )}
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
};
