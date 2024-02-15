import { UserCard } from '../UserCard';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { USERS_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { makeUrl } from '@/utils/routing';

type UserPanelProps = {
  userId: string;
  followed: string[];
  onFollow: (userId: string) => void;
  isFollowEnabled: boolean;
};

export const UserPanel = (props: UserPanelProps) => {
  const api = useApi();
  const { followed, onFollow, userId, isFollowEnabled } = props;

  const queryResult = useQuery<InternalConsumerUser | InternalBusinessUser>(
    USERS_ITEM(userId),
    () => {
      if (userId == null) {
        throw new Error(`Id is not defined`);
      }

      return api.getUsersItem({ userId });
    },
  );

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
                  makeUrl(`/users/list/${user.type.toLowerCase()}/${user.userId}`),
                  '_blank',
                )
              }
            >
              Go to user details
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
