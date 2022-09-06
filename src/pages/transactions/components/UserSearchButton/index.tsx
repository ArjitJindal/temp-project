import React from 'react';
import UserProfileIcon from './user_profile.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';
import UserSearchPopup from '@/pages/transactions/components/UserSearchPopup';

interface Props {
  userId: string | null;
  onConfirm: (userId: string | null) => void;
}

export default function UserSearchButton(props: Props) {
  const { userId, onConfirm } = props;

  return (
    <UserSearchPopup
      initialSearch={userId ?? ''}
      onConfirm={(user) => {
        onConfirm(user?.userId ?? null);
      }}
    >
      <ActionButton
        color="GREEN"
        icon={<UserProfileIcon />}
        analyticsName="user-filter"
        isActive={userId != null}
        onClear={() => {
          onConfirm(null);
        }}
      >
        {userId ?? 'Find user'}
      </ActionButton>
    </UserSearchPopup>
  );
}
