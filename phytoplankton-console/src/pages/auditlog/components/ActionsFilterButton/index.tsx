import React from 'react';
import { EditOutlined } from '@ant-design/icons';
import PopupContent from './PopupContent';
import { AuditLogActionEnum } from '@/apis';
import DefaultQuickFilter from '@/components/library/QuickFilter';

interface Props {
  initialState: AuditLogActionEnum[];
  onConfirm: (newState: AuditLogActionEnum[]) => void;
}

export default function ActionsFilterButton(props: Props) {
  const { initialState, onConfirm } = props;

  return (
    <DefaultQuickFilter
      icon={<EditOutlined />}
      title={'Action'}
      buttonText={initialState.length > 0 ? initialState.join(', ') : undefined}
      analyticsName="action-filter"
      onClear={
        initialState.length > 0
          ? () => {
              onConfirm([]);
            }
          : undefined
      }
    >
      {({ setOpen }) => (
        <PopupContent
          initialState={initialState}
          onConfirm={(value) => {
            onConfirm(value);
            setOpen(false);
          }}
          onReset={() => {
            onConfirm([]);
            setOpen(false);
          }}
        />
      )}
    </DefaultQuickFilter>
  );
}
