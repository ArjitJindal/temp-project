import React from 'react';
import { ContactsOutlined } from '@ant-design/icons';
import PopupContent from './PopupContent';
import { AuditLogType } from '@/apis';
import DefaultQuickFilter from '@/components/library/QuickFilter';

interface Props {
  initialState: AuditLogType[];
  onConfirm: (newState: AuditLogType[]) => void;
}

export default function EntityFilterButton(props: Props) {
  const { initialState, onConfirm } = props;

  return (
    <DefaultQuickFilter
      icon={<ContactsOutlined />}
      title={'Entity'}
      buttonText={initialState.length > 0 ? initialState.join(', ') : undefined}
      analyticsName="entity-filter"
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
