import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { useIsInviteDisabled } from './utils';
import { RoleSelect } from './RoleSelect';
import SecondPersonFields, { SecondPerson } from './SecondPersonFields';
import * as ArrayUtils from '@/utils/array';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { Account, AccountPatchPayload, EscalationLevel } from '@/apis';
import { getErrorMessage } from '@/utils/lang';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getBranding } from '@/utils/branding';
import { useAuth0User, useInvalidateUsers } from '@/utils/user-utils';
import TextInput from '@/components/library/TextInput';
import { useIsChanged } from '@/utils/hooks';
import Modal from '@/components/library/Modal';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import RadioGroup from '@/components/ui/RadioGroup';
import { email, notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { and } from '@/components/library/Form/utils/validation/combinators';
import Alert from '@/components/library/Alert';
import { getOr } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';
import { ExpandContentButton } from '@/components/library/ExpandContentButton';

interface Props {
  editAccount: Account | null;
  onSuccess: () => void;
  isVisibile: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
  accounts: Account[];
}

type ReviewPermission = 'MAKER' | 'CHECKER' | 'ESCALATION_L1' | 'ESCALATION_L2';

type FormValues = Pick<Account, 'email' | 'role' | 'staffId' | 'department'> & {
  reviewPermissions?: ReviewPermission;
  checker?: SecondPerson;
  escalationL2?: SecondPerson;
  name?: string;
};

const defaultState: FormValues = {
  role: 'admin',
  email: '',
  reviewPermissions: undefined,
  checker: {
    type: 'ACCOUNT',
  },
  escalationL2: {
    type: 'ACCOUNT',
  },
};

export default function AccountForm(props: Props) {
  const { editAccount, onSuccess, accounts, isVisibile: isVisible } = props;

  const api = useApi();
  const user = useAuth0User();

  const branding = getBranding();
  const settings = useSettings();
  const maxSeats = settings.limits?.seats ?? 0;

  const isEdit = editAccount !== null;

  const accountId = editAccount?.id;

  const isInviteDisabled = useIsInviteDisabled();

  const isEscalationsEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const isMultiEscalationsEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

  const isReviewerIdAlreadyUsed =
    isEdit && accounts.some((account) => account.reviewerId === accountId);
  const isEscalationV2AlreadyUsed =
    isEdit && accounts.some((account) => account.escalationReviewerId === accountId);

  const defaultValues = useMemo((): FormValues => {
    if (editAccount) {
      const values: FormValues = {
        ...defaultState,
        role: editAccount?.role || 'admin',
        email: editAccount?.email || '',
        name: editAccount?.name || '',
        staffId: editAccount?.staffId || '',
        department: editAccount?.department || '',
      };

      if (isEscalationsEnabled) {
        let reviewPermissions: ReviewPermission | undefined = undefined;
        if (editAccount.isReviewer) {
          reviewPermissions = 'CHECKER';
        } else if (editAccount.reviewerId != null) {
          reviewPermissions = 'MAKER';
        } else if (editAccount.escalationLevel === 'L1') {
          reviewPermissions = 'ESCALATION_L1';
        } else if (editAccount.escalationLevel === 'L2') {
          reviewPermissions = 'ESCALATION_L2';
        }
        values.reviewPermissions = reviewPermissions;

        if (editAccount.reviewerId != null) {
          values.checker = {
            type: 'ACCOUNT',
            assignees: [editAccount.reviewerId],
          };
        }
        if (editAccount.escalationReviewerId) {
          values.escalationL2 = {
            type: 'ACCOUNT',
            assignees: [editAccount.escalationReviewerId],
          };
        }
      }
      return values;
    } else {
      return defaultState;
    }
  }, [isEscalationsEnabled, editAccount]);

  const formRef = useRef<FormRef<FormValues>>();

  const [showErrors, setShowErrors] = useState(false);

  const isVisibilityChanged = useIsChanged(isVisible);
  useEffect(() => {
    if (isVisibilityChanged && !isVisible) {
      formRef.current?.setValues(defaultValues);
      setShowErrors(false);
    }
  }, [defaultValues, isVisibilityChanged, isVisible]);

  const invalidateUsers = useInvalidateUsers();

  const isInviteButtonDisabled = useMemo(() => {
    if (isEdit) {
      return false;
    }
    if (getOr(isInviteDisabled, true)) {
      return true;
    }
    return false;
  }, [isInviteDisabled, isEdit]);

  const inviteMutation = useMutation<unknown, unknown, FormValues>(
    async (payload) => {
      const hide = message.loading('Sending invitation...');
      try {
        if (!payload.email) {
          throw new Error(`E-mail can not be empty`);
        }
        let escalationLevel: EscalationLevel | undefined = undefined;
        if (payload.reviewPermissions === 'ESCALATION_L1') {
          escalationLevel = 'L1';
        } else if (payload.reviewPermissions === 'ESCALATION_L2') {
          escalationLevel = 'L2';
        }

        return await api.accountsInvite({
          AccountInvitePayload: {
            name: payload.name,
            staffId: payload.staffId,
            department: payload.department,
            email: payload.email,
            role: payload.role,
            escalationLevel: escalationLevel,
            isReviewer: payload.reviewPermissions === 'CHECKER',
            reviewerId:
              payload.reviewPermissions === 'MAKER' ? payload.checker?.assignees?.[0] : undefined,
            escalationReviewerId:
              payload.reviewPermissions === 'ESCALATION_L1'
                ? payload.escalationL2?.assignees?.[0]
                : undefined,
          },
        });
      } finally {
        hide?.();
      }
    },
    {
      onSuccess: async (data) => {
        if (!data) {
          return;
        }
        message.success('User invited!');
        onSuccess();
        props.onChangeVisibility(false);
        await new Promise((resolve) => setTimeout(resolve, 3000)); // sleep for 3 seconds to let the account get synced
        invalidateUsers.invalidate();
      },
      onError: (e) => {
        message.fatal(`Failed to invite user - ${getErrorMessage(e)}`, e);
      },
    },
  );

  const editMutation = useMutation<unknown, unknown, FormValues>(
    async (payload) => {
      const hide = message.loading('Updating account...');
      try {
        if (accountId == null) {
          throw new Error(`Account id for editing can not be empty`);
        }

        let escalationLevel: EscalationLevel | undefined = undefined;
        if (payload.reviewPermissions === 'ESCALATION_L1') {
          escalationLevel = 'L1';
        } else if (payload.reviewPermissions === 'ESCALATION_L2') {
          escalationLevel = 'L2';
        }

        const accountPatchPayload: AccountPatchPayload = {
          role: payload.role,
          escalationLevel: escalationLevel,
          isReviewer: payload.reviewPermissions === 'CHECKER',
          reviewerId:
            payload.reviewPermissions === 'MAKER' ? payload.checker?.assignees?.[0] : undefined,
          escalationReviewerId:
            payload.reviewPermissions === 'ESCALATION_L1'
              ? payload.escalationL2?.assignees?.[0]
              : undefined,
          staffId: payload.staffId,
          department: payload.department,
          name: payload.name,
        };

        return await api.accountsEdit({
          accountId: accountId,
          AccountPatchPayload: accountPatchPayload,
        });
      } finally {
        hide?.();
      }
    },
    {
      onSuccess: (data) => {
        if (!data) {
          return;
        }
        message.success('Account updated!');
        onSuccess();
        props.onChangeVisibility(false);
        invalidateUsers.invalidate();
      },
      onError: (e) => {
        message.fatal(`Failed to update account - ${getErrorMessage(e)}`, e);
      },
    },
  );

  const resendInviteMutation = useMutation<unknown, unknown, { accountId: string; email: string }>(
    async (payload) => {
      const hide = message.loading('Resending invitation...');
      try {
        return await api.accountsResendInvite({
          accountId: payload.accountId,
          ResendAccountInvitePayload: { email: payload.email },
        });
      } finally {
        hide?.();
      }
    },
    {
      onSuccess: () => {
        message.success('Invitation resent!');
        onSuccess();
      },
      onError: (e) => {
        message.fatal(`Failed to resend invitation - ${getErrorMessage(e)}`, e);
      },
    },
  );

  const resetPasswordMutation = useMutation<unknown, unknown, { accountId: string }>(
    async (payload) => {
      const hide = message.loading('Resetting password...');
      try {
        return await api.accountsResetPassword({ accountId: payload.accountId });
      } finally {
        hide();
      }
    },
    {
      onSuccess: () => {
        message.success('Password reset!');
        onSuccess();
      },
      onError: (e) => {
        message.fatal(`Failed to reset password - ${getErrorMessage(e)}`, e);
      },
    },
  );

  const handleSubmit = useCallback(
    (values: FormValues, state: { isValid: boolean }) => {
      if (!state.isValid) {
        message.warn(
          'Please, fill all the required fields and make sure that all fields contains appropriate values!',
        );
        setShowErrors(true);
        return;
      }
      if (isEdit) {
        editMutation.mutate(values);
      } else {
        inviteMutation.mutate(values);
      }
    },
    [isEdit, editMutation, inviteMutation],
  );

  const isAdvancedWorkflowsEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');

  return (
    <Modal
      title={isEdit ? 'Edit account' : 'Invite user'}
      isOpen={isVisible}
      onOk={() => {
        formRef.current?.submit();
      }}
      okProps={{
        type: 'PRIMARY',
        children: isEdit ? 'Save' : 'Invite',
        testName: 'accounts-invite',
        isDisabled: isInviteButtonDisabled,
        isLoading: inviteMutation.isLoading || editMutation.isLoading,
        requiredPermissions: ['accounts:overview:write'],
      }}
      onCancel={() => props.onChangeVisibility(false)}
      cancelProps={{
        type: 'TETRIARY',
      }}
    >
      <Form<FormValues>
        initialValues={defaultValues}
        ref={formRef}
        className={s.container}
        onSubmit={handleSubmit}
        alwaysShowErrors={showErrors}
        formValidators={[
          isReviewerIdAlreadyUsed &&
            ((values) => {
              return values?.reviewPermissions !== 'CHECKER'
                ? 'This checker is already assigned to a maker'
                : null;
            }),
          isEscalationV2AlreadyUsed &&
            ((values) => {
              return values?.reviewPermissions !== 'ESCALATION_L2'
                ? 'This checker is already assigned to a maker'
                : null;
            }),
        ].filter(ArrayUtils.notEmpty)}
        fieldValidators={({ values }) => ({
          email: and([notEmpty, email]),
          role: notEmpty,
          ...(isAdvancedWorkflowsEnabled
            ? {
                ...(values?.reviewPermissions === 'MAKER'
                  ? {
                      checker: {
                        type: notEmpty,
                        ...(values.checker?.type === 'ROLE'
                          ? {
                              role: notEmpty,
                            }
                          : {
                              assignees: notEmpty,
                            }),
                      },
                    }
                  : {}),
                ...(values?.reviewPermissions === 'ESCALATION_L1' && isMultiEscalationsEnabled
                  ? {
                      escalationL2: {
                        type: notEmpty,
                        ...(values.escalationL2?.type === 'ROLE'
                          ? {
                              role: notEmpty,
                            }
                          : {
                              assignees: notEmpty,
                            }),
                      },
                    }
                  : {}),
              }
            : {}),
        })}
      >
        {({ valuesState: [values] }) => (
          <>
            <InputField<FormValues, 'name'> name={'name'} label={'Name'}>
              {(inputProps) => <TextInput {...inputProps} />}
            </InputField>
            <InputField<FormValues, 'email'>
              name={'email'}
              label={'Email'}
              labelProps={{ required: { value: true, showHint: true } }}
            >
              {(inputProps) => <TextInput {...inputProps} testName="accounts-email" />}
            </InputField>
            <ExpandContentButton suffixText="advanced options">
              <>
                <InputField<FormValues, 'staffId'> name={'staffId'} label={'Staff ID'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<FormValues, 'department'> name={'department'} label={'Department'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </>
            </ExpandContentButton>
            <InputField<FormValues, 'role'>
              name={'role'}
              label={'Role'}
              labelProps={{ required: { value: true, showHint: true } }}
            >
              {(inputProps) => (
                <RoleSelect
                  {...inputProps}
                  isDisabled={user.userId === accountId || editAccount?.role == 'root'}
                />
              )}
            </InputField>
            {isAdvancedWorkflowsEnabled && (
              <>
                <InputField<FormValues, 'reviewPermissions'>
                  label={'Review permissions'}
                  name={'reviewPermissions'}
                >
                  {(inputProps) => (
                    <div className={s.permissionsGroup}>
                      <RadioGroup<ReviewPermission | undefined>
                        options={(
                          [undefined, 'MAKER', 'CHECKER', 'ESCALATION_L1', 'ESCALATION_L2'] as const
                        )
                          .filter((x) => {
                            if (x === 'ESCALATION_L2') {
                              return isMultiEscalationsEnabled;
                            }
                            return true;
                          })
                          .map((x) => {
                            let label: string;
                            if (x == null) {
                              label = 'None';
                            } else if (x === 'ESCALATION_L1') {
                              label = isMultiEscalationsEnabled
                                ? 'Escalation L1'
                                : 'Escalation reviewer';
                            } else if (x === 'ESCALATION_L2') {
                              label = 'Escalation L2';
                            } else {
                              label = humanizeAuto(x);
                            }
                            return {
                              value: x,
                              label: label,
                            };
                          })}
                        {...inputProps}
                      />
                    </div>
                  )}
                </InputField>
                {values.reviewPermissions === 'MAKER' && (
                  <SecondPersonFields<FormValues, 'checker'>
                    name={'checker'}
                    typeLabel={'Checker type'}
                    assignmentsLabel={'Select a Checker account'}
                    assignmentsPlaceholder={'Select a Checker account'}
                    assignmentsCustomFilter={(account) => {
                      return account.isReviewer ?? false;
                    }}
                    roleLabel={`Select checker role`}
                    rolePlaceholder={'Select checker role'}
                  />
                )}
                {isMultiEscalationsEnabled && values.reviewPermissions === 'ESCALATION_L1' && (
                  <SecondPersonFields<FormValues, 'escalationL2'>
                    name={'escalationL2'}
                    typeLabel={
                      'Select ‘Escalation L2’ type to escalate ‘Escalation L1’ cases/alerts'
                    }
                    assignmentsCustomFilter={(account) => {
                      return account.escalationLevel === 'L2';
                    }}
                    assignmentsLabel={'Select an Escalation L2 account'}
                    assignmentsPlaceholder={'Select an Escalation L2 account'}
                    roleLabel={'Select ‘Escalation L2’ role'}
                    rolePlaceholder={'Select ‘Escalation L2’ role'}
                  />
                )}
              </>
            )}
            {isEdit && (
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'row' }}>
                <Button
                  type="SECONDARY"
                  onClick={() => {
                    if (editAccount) {
                      resendInviteMutation.mutate({
                        accountId: editAccount.id,
                        email: editAccount.email,
                      });
                    }
                  }}
                  requiredPermissions={['accounts:overview:write']}
                  style={{ width: 'fit-content' }}
                >
                  Resend invitation
                </Button>
                <Button
                  type="TETRIARY"
                  onClick={() => {
                    if (editAccount) {
                      resetPasswordMutation.mutate({ accountId: editAccount.id });
                    }
                  }}
                  requiredPermissions={['accounts:overview:write']}
                  style={{ width: 'fit-content' }}
                >
                  Reset password
                </Button>
              </div>
            )}
            {!isEdit && (
              <AsyncResourceRenderer resource={isInviteDisabled} renderLoading={() => <></>}>
                {(value) =>
                  value && (
                    <Alert type={'WARNING'}>
                      You have reached maximum no. of Seats ({maxSeats}). Please contact support at{' '}
                      <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a> if you
                      want additional seats
                    </Alert>
                  )
                }
              </AsyncResourceRenderer>
            )}
            <FormValidationErrors />
          </>
        )}
      </Form>
    </Modal>
  );
}
