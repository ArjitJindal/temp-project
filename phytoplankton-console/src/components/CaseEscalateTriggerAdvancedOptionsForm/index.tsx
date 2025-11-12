import cn from 'clsx';
import { useLocalStorageState } from 'ahooks';
import { ModalWidth, isModalWidthGreatherThan } from '../library/Modal';
import InputField from '../library/Form/InputField';
import NestedForm from '../library/Form/NestedForm';
import TextArea from '../library/TextArea';
import s from './style.module.less';
import { UpdateUserTags } from './components/UpdateUserTags';
import { UpdateUserDetails } from './components/UpdateuserDetails/UpdateUserDetails';
import { ScreeningDetailsUpdateForm } from '@/pages/users-item/UserDetails/ConsumerUserDetails/ScreeningDetails/UpdateForm';
import { DispositionApprovalWarnings } from '@/components/DispositionApprovalWarnings';
import { KYCStatus, KYCAndUserStatusChangeReason, UserState } from '@/apis';
import { FormValues } from '@/pages/case-management/components/StatusChangeModal';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

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
const modalId = 'status-change-modal';

export const CaseEscalateTriggerAdvancedOptionsForm = (props: { user?: TableUser }) => {
  const { user } = props;
  const [size, _setSize] = useLocalStorageState<ModalWidth | undefined>(
    modalId ?? 'UNKNOWN_MODAL',
    { listenStorageChange: true },
  );

  // Check if USER_CHANGES_APPROVAL feature is enabled
  const isUserChangesApprovalEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');

  return (
    <>
      {/* Show approval workflow warnings at the top only if feature is enabled */}
      {isUserChangesApprovalEnabled && (
        <DispositionApprovalWarnings className={s.approvalWarnings} />
      )}

      <UpdateUserDetails size={size} />
      <div className={isModalWidthGreatherThan(size ?? 'M', 'M') ? s.rowLayout : s.columnLayout}>
        <>
          <NestedForm<FormValues> name={'tags'}>
            <UpdateUserTags
              size={size}
              extraClassName={cn(s.screeningDetailWrapper)}
              tags={user?.tags ?? []}
            />
          </NestedForm>
          {user?.type === 'CONSUMER' && (
            <NestedForm<FormValues> name={'screeningDetails'}>
              <ScreeningDetailsUpdateForm
                extraClassName={cn(
                  s.screeningDetailWrapper,
                  isModalWidthGreatherThan(size ?? 'M', 'M') && s.scroll,
                )}
                size={'M'}
                showDeleteIcon={true}
                addFormAtTop={true}
              />
            </NestedForm>
          )}
        </>
      </div>
      <InputField<FormValues, 'actionReason'> name="actionReason" label={'Reason'}>
        {(inputProps) => (
          <TextArea {...inputProps} placeholder={'Add a reason for the updates made'} />
        )}
      </InputField>
    </>
  );
};
