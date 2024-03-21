import React from 'react';
import { HighlightOutlined } from '@ant-design/icons';
import PopupContent from './PopupContent';
import { useUsers } from '@/utils/user-utils';
import DefaultQuickFilter from '@/components/library/QuickFilter';

interface Props {
  initialState: string[];
  onConfirm: (newState: string[]) => void;
  title?: string;
  hideIcon?: boolean;
}

export default function ActionTakenByFilterButton(props: Props) {
  const { initialState, onConfirm } = props;
  const [users, loadingUsers] = useUsers();

  return (
    <DefaultQuickFilter
      title={props.title ?? 'Action taken by'}
      analyticsName="action-taken-by"
      icon={props.hideIcon ? undefined : <HighlightOutlined />}
      buttonText={
        (!loadingUsers && !initialState) || initialState.length === 0
          ? undefined
          : initialState.map((userId) => users[userId]?.name ?? userId)?.join(', ')
      }
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
          onCancel={() => {
            setOpen(false);
          }}
        />
      )}
    </DefaultQuickFilter>
  );
}
