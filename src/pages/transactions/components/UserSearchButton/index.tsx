import React, { useState } from 'react';
import { Popover } from 'antd';
import UserProfileIcon from './user_profile.react.svg';
import PopupContent from './PopupContent';
import s from './style.module.less';
import ActionButton from '@/components/ui/Table/ActionButton';

interface Props {
  userId: string | null;
  onConfirm: (userId: string | null) => void;
}

export default function UserSearchButton(props: Props) {
  const { userId, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={
        <PopupContent
          initialSearch={userId ?? ''}
          key={`${visible}`}
          onConfirm={(user) => {
            onConfirm(user.userId);
            setVisible(false);
          }}
          onCancel={() => {
            setVisible(false);
          }}
        />
      }
      trigger="click"
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
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
    </Popover>
  );
}
