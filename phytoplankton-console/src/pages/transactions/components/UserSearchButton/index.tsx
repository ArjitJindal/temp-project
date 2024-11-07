import React, { useEffect, useState } from 'react';
import UserProfileIcon from './user_profile.react.svg';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import { getErrorMessage } from '@/utils/lang';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';
import PopupContent from '@/pages/transactions/components/UserSearchPopup/PopupContent';

interface Props {
  userId: string | null;
  onConfirm: (userId: string | null) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function UserSearchButton(props: Props) {
  const { userId, onConfirm, onUpdateFilterClose } = props;
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
    Promise.all([api.getConsumerUsersItem({ userId }), api.getBusinessUsersItem({ userId })])
      .then(([consumerUser, businessUser]) => {
        if (isCanceled) {
          return;
        }
        if (consumerUser.userDetails != null) {
          setUserRest(success(consumerUser));
        } else {
          setUserRest(success(businessUser));
        }
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

  const isEmpty = userId === null;

  return (
    <QuickFilterBase
      title={'User ID/Name'}
      icon={<UserProfileIcon />}
      buttonText={user ? getUserName(user) : userId}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm(null);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      {({ isOpen, setOpen }) => (
        <PopupContent
          initialSearch={userId ?? ''}
          isVisible={isOpen}
          onConfirm={(user) => {
            setUserRest(success(user));
            onConfirm(user?.userId ?? null);
            setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
          }}
          onEnterInput={(userId) => {
            setUserRest(init());
            onConfirm(userId);
            setOpen(false);
          }}
        />
      )}
    </QuickFilterBase>
  );
}
