import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './style.module.less';
import Select from '@/components/library/Select';
import { KYCStatus, UserState } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { humanizeKYCStatus } from '@/components/utils/humanizeKYCStatus';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import { ModalWidth, isModalWidthGreatherThan } from '@/components/library/Modal';
import { FormValues } from '@/pages/case-management/components/StatusChangeModal';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import { useUserLists } from '@/utils/queries/hooks';
import { getOr } from '@/utils/asyncResource';

type UpdateUserDetailsProps = {
  size: ModalWidth | undefined;
};

export const UpdateUserDetails = (props: UpdateUserDetailsProps) => {
  const { size } = props;
  const settings = useSettings();
  const queryResults = useUserLists();

  return (
    <div className={isModalWidthGreatherThan(size ?? 'M', 'M') ? s.rowLayout : s.columnLayout}>
      <InputField<FormValues, 'userStateDetails'>
        name={'userStateDetails'}
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
              console.info('Value for user state', value);
              inputProps?.onChange?.(value);
            }}
          />
        )}
      </InputField>

      <InputField<FormValues, 'kycStatusDetails'>
        name={'kycStatusDetails'}
        label={'Update KYC status to'}
      >
        {(inputProps) => (
          <Select<KYCStatus>
            options={KYC_STATUSS.map((state) => ({
              label: humanizeKYCStatus(state),
              value: state,
            }))}
            {...inputProps}
            onChange={(value) => {
              inputProps?.onChange?.(value);
            }}
          />
        )}
      </InputField>

      <InputField<FormValues, 'eoddDate'> name="eoddDate" label="EODD">
        {(inputProps) => (
          <DatePicker
            placeholder="MM/DD/YYYY"
            format="MM/DD/YYYY"
            value={inputProps.value ? dayjs(inputProps.value, 'MM/DD/YYYY') : null}
            onChange={(date) => {
              if (date) {
                inputProps.onChange?.(date.unix() * 1000);
              }
            }}
          />
        )}
      </InputField>

      <InputField<FormValues, 'listId'> name="listId" label="Add user to selected list below">
        {(inputProps) => (
          <Select<string>
            options={getOr(queryResults.data, []).map((list) => ({
              label: list.metadata?.name || list.listId,
              value: list.listId,
            }))}
            {...inputProps}
            onChange={(value) => {
              inputProps?.onChange?.(value);
            }}
            placeholder={'Search for List ID'}
          />
        )}
      </InputField>
    </div>
  );
};
