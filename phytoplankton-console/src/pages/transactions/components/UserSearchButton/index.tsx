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
import { UserType } from '@/apis';
import { UserSearchParams } from '@/pages/users/users-list';

interface Props {
  userId: string | null;
  title?: string;
  onConfirm: (cb: (oldState: any) => any) => void;
  onUpdateFilterClose?: (status: boolean) => void;
  userType?: UserType;
  handleChangeParams?: (params: UserSearchParams) => void;
  params?: UserSearchParams;
  filterType?: 'id' | 'name';
}

export default function UserSearchButton(props: Props) {
  const {
    userId,
    title,
    onConfirm,
    onUpdateFilterClose,
    userType,
    handleChangeParams,
    params,
    filterType,
  } = props;
  const settings = useSettings();
  const [userRest, setUserRest] = useState<AsyncResource<{ userId: string; name: string }>>(init());
  const user = getOr(userRest, null);
  const currentUserId = user?.userId ?? null;
  const api = useApi();

  const handleConfirm = (newUserId: string | null, newUserName: string | null) => {
    onConfirm((state) => ({
      ...state,
      userName: newUserName ?? undefined,
      userId: newUserId ?? undefined,
    }));
  };

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

  const isEmpty = !userId && !params?.userName;

  return (
    <QuickFilterBase
      title={
        title ?? `${firstLetterUpper(settings.userAlias)} ${filterType === 'id' ? 'ID' : 'name'}`
      }
      icon={<UserProfileIcon />}
      buttonText={filterType === 'id' ? userId : user?.name ?? userId ?? params?.userName}
      onClear={
        isEmpty
          ? undefined
          : () => {
              handleConfirm(null, null);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      {({ isOpen, setOpen }) => (
        <PopupContent
          params={params}
          handleChangeParams={handleChangeParams}
          initialSearch={userId ?? ''}
          filterType={filterType}
          isVisible={isOpen}
          onConfirm={(user) => {
            setUserRest(success({ userId: user.userId, name: user.name ?? '' }));
            handleConfirm(user.userId, user.name ?? null);
            setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
          }}
          onEnterInput={(userId) => {
            setUserRest(init());
            handleConfirm(userId, null);
            setOpen(false);
          }}
          userType={userType}
          onClose={() => setOpen(false)}
        />
      )}
    </QuickFilterBase>
  );
}
