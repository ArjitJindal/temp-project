import { useState } from 'react';
import { firstLetterUpper, humanizeConstant } from '@flagright/lib/utils/humanize';
import { humanizeKYCStatus } from '../utils/humanizeKYCStatus';
import { useFormContext } from '../library/Form/utils/hooks';
import s from './style.module.less';
import TagsInput from './components/TagsInput';
import { useQuery } from '@/utils/queries/hooks';
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
  PEPStatus,
  PepRank,
  RuleType,
} from '@/apis';
import InputField from '@/components/library/Form/InputField';
import { PEP_RANK_OPTIONS } from '@/pages/users-item/UserDetails/ConsumerUserDetails/PepDetails/PepStatus';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { LISTS } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';

type UserStatusTriggersAdvancedOptionsFormProps = {
  type: 'CASE' | 'RULE';
  ruleType?: RuleType;
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
  const { type, ruleType } = props;
  const settings = useSettings();
  const [isUserStateDetailsOpen, setIsUserStateDetailsOpen] = useState(false);
  const [isKYCStatusDetailsOpen, setIsKYCStatusDetailsOpen] = useState(false);
  const api = useApi();

  const {
    values,
  }: {
    values: {
      userStateDetails: UserStateDetails;
      kycStatusDetails: KYCStatusDetails;
    };
  } = useFormContext();

  const queryResults = useQuery(LISTS('USER_ID'), async () => {
    return await api.getLists({
      filterListSubtype: ['USER_ID'],
    });
  });

  return (
    <>
      {type === 'RULE' && ruleType === 'TRANSACTION' && (
        <InputField<TriggersOnHit, 'usersToCheck'>
          name={'usersToCheck'}
          label={`${firstLetterUpper(settings.userAlias)}s to update`}
          description={`Select ${settings.userAlias}s of a transaction direction below for which the ${settings.userAlias}/KYC status needs to be updated. If set to ORIGIN, then only ${settings.userAlias}s of origin side state are updated.`}
          labelProps={{
            required: {
              value: true,
              showHint: true,
            },
          }}
        >
          {(inputProps) => (
            <SelectionGroup<TriggersOnHit['usersToCheck']>
              mode="SINGLE"
              options={(USER_DIRECTIONSS as UserDirections[]).map((direction) => ({
                label: humanizeConstant(direction),
                value: direction,
              }))}
              {...inputProps}
              value={inputProps?.value ?? 'ALL'}
            />
          )}
        </InputField>
      )}

      <NestedForm<TriggersOnHit> name={'userStateDetails'}>
        <div className={type === 'RULE' ? s.stateDetails : s.stateDetailsSingle}>
          <InputField<UserStateDetails, 'state'>
            name={'state'}
            label={`Update ${settings.userAlias?.toLowerCase()} state to`}
          >
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
            <InputField<UserStateDetails, 'reason'>
              name={'reason'}
              label={'Reason'}
              labelProps={{
                required: !!values?.userStateDetails?.state,
              }}
            >
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
            <InputField<UserStateDetails, 'reason'>
              name={'reason'}
              label={'Reason'}
              labelProps={{
                required: !!values?.kycStatusDetails?.status,
              }}
            >
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
      {type === 'RULE' && (
        <NestedForm<TriggersOnHit> name={'pepStatus'}>
          <div className={s.stateDetails}>
            <InputField<PEPStatus, 'isPepHit'> name={'isPepHit'} label={'Update PEP status to'}>
              {(inputProps) => (
                <Select
                  options={[
                    { label: 'Hit', value: true },
                    { label: 'Not Hit', value: false },
                  ]}
                  {...inputProps}
                />
              )}
            </InputField>
            <InputField<PEPStatus, 'pepRank'> name={'pepRank'} label={'PEP Rank'}>
              {(inputProps) => (
                <Select<PepRank>
                  options={PEP_RANK_OPTIONS.map((rank) => ({
                    label: humanizeConstant(rank),
                    value: rank,
                  }))}
                  mode="SINGLE"
                  {...inputProps}
                />
              )}
            </InputField>
          </div>
        </NestedForm>
      )}
      {type === 'RULE' && (
        <InputField<TriggersOnHit, 'tags'> name="tags" label="Update tags to">
          {(inputProps) => <TagsInput {...inputProps} />}
        </InputField>
      )}
      {type === 'RULE' && (
        <InputField<TriggersOnHit, 'listId'> name="listId" label="Update List to">
          {(inputProps) => {
            return (
              <Select<string>
                options={getOr(queryResults.data, []).map((list) => ({
                  label: list.metadata?.name || list.listId,
                  value: list.listId,
                }))}
                {...inputProps}
                placeholder={isLoading(queryResults.data) ? 'Loading...' : 'Search for List Name'}
                isLoading={isLoading(queryResults.data)}
              />
            );
          }}
        </InputField>
      )}
    </>
  );
};
