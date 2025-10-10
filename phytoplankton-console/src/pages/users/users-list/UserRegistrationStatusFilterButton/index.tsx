import React from 'react';
import PopupContent from './PopupContent';
import { UserRegistrationStatus } from '@/apis';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  userRegistrationStatus: UserRegistrationStatus[];
  onConfirm: (userRegistrationStatus: UserRegistrationStatus[]) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export function UserRegistrationStatusFilterButton(props: Props) {
  const { userRegistrationStatus, onConfirm, onUpdateFilterClose } = props;

  const isEmpty = userRegistrationStatus.length === 0;
  return (
    <QuickFilterBase
      analyticsName="registration-status-business-filter"
      title="Registration status"
      buttonText={isEmpty ? undefined : userRegistrationStatus.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      <PopupContent value={userRegistrationStatus} onConfirm={onConfirm} />
    </QuickFilterBase>
  );
}
