import React, { useEffect, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import UserProfileIcon from './user_profile.react.svg';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import { getErrorMessage } from '@/utils/lang';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';
import PopupContent from '@/pages/transactions/components/UserSearchPopup/PopupContent';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props {
  userId: string | null;
  onConfirm: (userId: string | null) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function UserSearchButton(props: Props) {
  const { userId, onConfirm, onUpdateFilterClose } = props;
  const settings = useSettings();
  const [userRest, setUserRest] = useState<AsyncResource<{ userId: string; name: string }>>(init());
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
          setUserRest(success({ userId: consumerUser.userId, name: getUserName(consumerUser) }));
        } else {
          setUserRest(success({ userId: businessUser.userId, name: getUserName(businessUser) }));
        }
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        setUserRest(
          failed(`Unable to find ${settings.userAlias} by id "${userId}". ${getErrorMessage(e)}`),
        );
      });

    return () => {
      isCanceled = true;
    };
  }, [api, userId, currentUserId, settings.userAlias]);

  const isEmpty = userId === null;

  return (
    <QuickFilterBase
      title={`${firstLetterUpper(settings.userAlias)} ID/Name`}
      icon={<UserProfileIcon />}
      buttonText={user?.name ?? userId}
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
            setUserRest(success({ userId: user.userId, name: user.name ?? '' }));
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
