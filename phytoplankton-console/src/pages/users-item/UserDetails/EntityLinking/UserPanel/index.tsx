import { useNavigate } from 'react-router';
import React from 'react';
import { useApi } from '@/api';
import { useApiTime } from '@/utils/tracker';
import { useQuery } from '@/utils/queries/hooks';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { USERS_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { makeUrl } from '@/utils/routing';
import { UserCard } from '@/pages/users-item/UserDetails/EntityLinking/UserCard';

type UserPanelProps = {
  userId: string;
  followed: string[];
  onFollow: (userId: string) => void;
};

export const UserPanel = (props: UserPanelProps) => {
  const api = useApi();
  const measure = useApiTime();
  const navigate = useNavigate();
  const { followed, onFollow, userId } = props;

  const queryResult = useQuery<InternalConsumerUser | InternalBusinessUser>(
    USERS_ITEM(userId),
    () => {
      if (userId == null) {
        throw new Error(`Id is not defined`);
      }

      return measure(() => api.getUsersItem({ userId }), 'Consumer User Item');
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
                navigate(makeUrl(`/users/list/${user.type.toLowerCase()}/${user.userId}`, {}))
              }
            >
              Go to user details
            </Button>
            {!followed.includes(user.userId) && (
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
