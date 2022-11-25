import React, { useState } from 'react';
import { Popover } from 'antd';
import { ContactsFilled } from '@ant-design/icons';
import PopupContent from './PopupContent';
import ActionButton from '@/components/ui/Table/ActionButton';
import { AuditLogType } from '@/apis';

interface Props {
  initialState: AuditLogType[];
  onConfirm: (newState: AuditLogType[]) => void;
}

export default function EntityFilterButton(props: Props) {
  const { initialState, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  return (
    <Popover
      content={
        <PopupContent
          key={`${visible}`}
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
        color="SKY_BLUE"
        icon={<ContactsFilled />}
        analyticsName="user-filter"
        isActive={initialState.length > 0}
        onClear={() => {
          onConfirm([]);
        }}
      >
        {!initialState || initialState.length === 0 ? 'Entity' : initialState?.join(', ')}
      </ActionButton>
    </Popover>
  );
}
