import React, { useState } from 'react';
import { Popover } from 'antd';
import { HighlightOutlined } from '@ant-design/icons';
import PopupContent from './PopupContent';
import ActionButton from '@/components/ui/Table/ActionButton';
import { useUsers } from '@/utils/user-utils';

interface Props {
  initialState: string[];
  onConfirm: (newState: string[]) => void;
}

export default function ActionTakenByFilterButton(props: Props) {
  const { initialState, onConfirm } = props;
  const [visible, setVisible] = useState(false);
  const [users, loadingUsers] = useUsers();

  return (
    <Popover
      content={
        <PopupContent
          initialState={initialState}
          onConfirm={(value) => {
            onConfirm(value);
            setVisible(false);
          }}
          onCancel={() => {
            setVisible(false);
          }}
        />
      }
      trigger="click"
      placement="bottomRight"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="ORANGE"
        icon={<HighlightOutlined />}
        analyticsName="user-filter"
        isActive={initialState.length > 0}
        onClear={() => {
          onConfirm([]);
        }}
      >
        {(!loadingUsers && !initialState) || initialState.length === 0
          ? 'Action Taken By'
          : initialState.map((userId) => users[userId]?.name ?? userId)?.join(', ')}
      </ActionButton>
    </Popover>
  );
}
