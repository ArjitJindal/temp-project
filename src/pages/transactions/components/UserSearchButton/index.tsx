import React, { useEffect, useState } from 'react';
import UserProfileIcon from './user_profile.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';
import UserSearchPopup from '@/pages/transactions/components/UserSearchPopup';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import { getErrorMessage } from '@/utils/lang';
import { Mode } from '@/pages/transactions/components/UserSearchPopup/types';

interface Props {
  userId: string | null;
  initialMode?: Mode;
  onConfirm: (userId: string | null, mode: Mode | null) => void;
}

export default function UserSearchButton(props: Props) {
  const { initialMode, userId, onConfirm } = props;
  const [userRest, setUserRest] = useState<
    AsyncResource<InternalConsumerUser | InternalBusinessUser>
  >(init());
  const user = getOr(userRest, null);
  const currentUserId = user?.userId ?? null;
  const api = useApi();
  useEffect(() => {
    if (userId == null || userId === 'all') {
      setUserRest(init());
      return () => {};
    }
    if (userId === currentUserId) {
      return () => {};
    }

    let isCanceled = false;
    setUserRest(loading());
    Promise.any([api.getConsumerUsersItem({ userId }), api.getBusinessUsersItem({ userId })])
      .then((user) => {
        if (isCanceled) {
          return;
        }
        setUserRest(success(user));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        setUserRest(failed(`Unable to find user by id "${userId}". ${getErrorMessage(e)}`));
      });
    return () => {
      isCanceled = true;
    };
  }, [api, userId, currentUserId]);

  return (
    <UserSearchPopup
      initialMode={initialMode ?? null}
      initialSearch={userId ?? ''}
      onConfirm={(user, mode) => {
        setUserRest(success(user));
        onConfirm(user?.userId ?? null, mode ?? null);
      }}
    >
      <ActionButton
        color="GREEN"
        icon={<UserProfileIcon />}
        analyticsName="user-filter"
        isActive={userId != null}
        onClear={() => {
          onConfirm(null, null);
        }}
      >
        {user ? getUserName(user) : userId || 'Find user'}
      </ActionButton>
    </UserSearchPopup>
  );
}
