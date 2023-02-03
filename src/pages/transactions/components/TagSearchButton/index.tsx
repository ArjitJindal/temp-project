import React, { useState } from 'react';
import { Popover } from 'antd';
import PopupContent from './PopupContent';
import ActionButton from '@/components/ui/Table/ActionButton';
import PriceTagIcon from '@/components/ui/icons/Remix/finance/price-tag-line.react.svg';
import { Value } from '@/pages/transactions/components/TagSearchButton/types';
import { useTableScrollVisible } from '@/utils/hooks';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
}

export default function TagSearchButton(props: Props) {
  const { initialState, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  useTableScrollVisible(setVisible);

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
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="BLUE"
        icon={<PriceTagIcon />}
        analyticsName="user-filter"
        isActive={initialState.key != null || initialState.value != null}
        onClear={() => {
          onConfirm({
            key: null,
            value: null,
          });
        }}
      >
        {initialState.key == null && initialState.value == null
          ? 'Filter by tag'
          : `${initialState.key ?? '*'}:${initialState.value ?? '*'}`}
      </ActionButton>
    </Popover>
  );
}
