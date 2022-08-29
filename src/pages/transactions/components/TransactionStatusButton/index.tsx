import React, { useState } from 'react';
import { Popover } from 'antd';
import UserProfileIcon from './user_profile.react.svg';
import s from './style.module.less';
import PopupContent from './PopupContent';
import ActionButton from '@/components/ui/Table/ActionButton';
import { RuleAction } from '@/apis';
import { getRuleActionTitle } from '@/utils/rules';

interface Props {
  status: RuleAction | undefined;
  onConfirm: (status: RuleAction | undefined) => void;
}

export default function StatusSearchButton(props: Props) {
  const { status, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  const displayName = (status: RuleAction | undefined) => {
    if (status === undefined) return 'All cases';
    if (status === 'FLAG') return 'FLAGGED';
    return `${status}ED`;
  };

  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={
        <PopupContent
          key={`${visible}`}
          onConfirm={(status) => {
            onConfirm(status);
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
        color="BLUE"
        icon={<UserProfileIcon />}
        analyticsName="status-filter"
        isActive={status != null}
        onClear={() => {
          onConfirm(undefined);
        }}
      >
        {status !== undefined ? getRuleActionTitle(status) : 'All cases'}
      </ActionButton>
    </Popover>
  );
}
