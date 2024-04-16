import { useState } from 'react';
import { humanizeKYCStatus } from '../utils/humanizeKYCStatus';
import s from './style.module.less';
import SelectionGroup from '@/components/library/SelectionGroup';
import { USER_DIRECTIONSS } from '@/apis/models-custom/UserDirections';
import Select from '@/components/library/Select';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { KYC_AND_USER_STATUS_CHANGE_REASONS } from '@/apis/models-custom/KYCAndUserStatusChangeReason';
import TextArea from '@/components/library/TextArea';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import NestedForm from '@/components/library/Form/NestedForm';
import {
  KYCStatus,
  KYCAndUserStatusChangeReason,
  TriggersOnHit,
  UserDirections,
  UserState,
} from '@/apis';
import InputField from '@/components/library/Form/InputField';
import { humanizeConstant } from '@/utils/humanize';

type UserStatusTriggersAdvancedOptionsFormProps = {
  type: 'CASE' | 'RULE';
};

export interface UserStateDetails {
  state: UserState;
  reason: KYCAndUserStatusChangeReason;
  description?: string;
}

export interface KYCStatusDetails {
  status: KYCStatus;
  reason: KYCAndUserStatusChangeReason;
  description?: string;
}

export const UserStatusTriggersAdvancedOptionsForm = (
  props: UserStatusTriggersAdvancedOptionsFormProps,
) => {
  const { type } = props;
  const [isUserStateDetailsOpen, setIsUserStateDetailsOpen] = useState(false);
  const [isKYCStatusDetailsOpen, setIsKYCStatusDetailsOpen] = useState(false);

  return (
    <>
      {type === 'RULE' && (
        <InputField<TriggersOnHit, 'usersToCheck'>
          name={'usersToCheck'}
          label={'Users to update'}
          description={
            'Select users of a transaction direction below for which the User/KYC status needs to be updated. If set to ORIGIN, then only users of origin side status are updated.'
          }
        >
          {(inputProps) => (
            <SelectionGroup<TriggersOnHit['usersToCheck']>
              mode="SINGLE"
              options={(USER_DIRECTIONSS as UserDirections[]).map((direction) => ({
                label: humanizeConstant(direction),
                value: direction,
              }))}
              {...inputProps}
            />
          )}
        </InputField>
      )}

      <NestedForm<TriggersOnHit> name={'userStateDetails'}>
        <div className={type === 'RULE' ? s.stateDetails : s.stateDetailsSingle}>
          <InputField<UserStateDetails, 'state'> name={'state'} label={'Update user status to'}>
            {(inputProps) => (
              <Select<UserState>
                options={USER_STATES.map((state) => ({
                  label: humanizeConstant(state),
                  value: state,
                }))}
                {...inputProps}
                onChange={(value) => {
                  if (value) {
                    setIsUserStateDetailsOpen(true);
                  }
                  inputProps?.onChange?.(value);
                }}
              />
            )}
          </InputField>
          {(type === 'RULE' || isUserStateDetailsOpen) && (
            <InputField<UserStateDetails, 'reason'> name={'reason'} label={'Reason'}>
              {(inputProps) => (
                <Select<KYCAndUserStatusChangeReason>
                  options={KYC_AND_USER_STATUS_CHANGE_REASONS.map((reason) => ({
                    label: humanizeConstant(reason),
                    value: reason,
                  }))}
                  mode="SINGLE"
                  {...inputProps}
                />
              )}
            </InputField>
          )}
        </div>
        {(type === 'RULE' || isUserStateDetailsOpen) && (
          <InputField<UserStateDetails, 'description'> name={'description'} label={'Description'}>
            {(inputProps) => <TextArea {...inputProps} />}
          </InputField>
        )}
      </NestedForm>

      <NestedForm<TriggersOnHit> name={'kycStatusDetails'}>
        <div className={type === 'RULE' ? s.stateDetails : s.stateDetailsSingle}>
          <InputField<KYCStatusDetails, 'status'> name={'status'} label={'Update KYC status to'}>
            {(inputProps) => (
              <Select<KYCStatus>
                options={KYC_STATUSS.map((state) => ({
                  label: humanizeKYCStatus(state),
                  value: state,
                }))}
                {...inputProps}
                onChange={(value) => {
                  if (value) {
                    setIsKYCStatusDetailsOpen(true);
                  }
                  inputProps?.onChange?.(value);
                }}
              />
            )}
          </InputField>
          {(type === 'RULE' || isKYCStatusDetailsOpen) && (
            <InputField<UserStateDetails, 'reason'> name={'reason'} label={'Reason'}>
              {(inputProps) => (
                <Select<KYCAndUserStatusChangeReason>
                  options={KYC_AND_USER_STATUS_CHANGE_REASONS.map((reason) => ({
                    label: humanizeConstant(reason),
                    value: reason,
                  }))}
                  mode="SINGLE"
                  {...inputProps}
                />
              )}
            </InputField>
          )}
        </div>
        {(type === 'RULE' || isKYCStatusDetailsOpen) && (
          <InputField<UserStateDetails, 'description'> name={'description'} label={'Description'}>
            {(inputProps) => <TextArea {...inputProps} />}
          </InputField>
        )}
      </NestedForm>
    </>
  );
};
