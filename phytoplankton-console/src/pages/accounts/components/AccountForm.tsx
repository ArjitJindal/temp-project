import React, { useEffect, useMemo, useState } from 'react';
import { startCase } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { isValidEmail } from '@flagright/lib/utils/regex';
import s from './styles.module.less';
import { useIsInviteDisabled } from './utils';
import { CloseMessage, message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { Account, AccountInvitePayload, AccountPatchPayload, AccountRole } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { getErrorMessage, isEqual } from '@/utils/lang';
import {
  Feature,
  useFeatureEnabled,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { getBranding } from '@/utils/branding';
import { useAuth0User, useInvalidateUsers } from '@/utils/user-utils';
import { P } from '@/components/ui/Typography';
import COLORS from '@/components/ui/colors';
import Label from '@/components/library/Label';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import Select from '@/components/library/Select';
import Drawer from '@/components/library/Drawer';
import TextInput from '@/components/library/TextInput';
import Checkbox from '@/components/library/Checkbox';
import { useIsChanged } from '@/utils/hooks';

interface Props {
  editAccount: Account | null;
  onSuccess: () => void;
  isVisibile: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
  accounts: Account[];
}

const REQUIRED_FIELDS = ['email', 'role'];

const defaultState = {
  name: '',
  reviewerId: undefined,
  role: 'admin',
  email: '',
  isReviewer: false,
};

const defaultEscalationsState = {
  escalationLevel: undefined,
  isReviewer: false,
};

export default function AccountForm(props: Props) {
  const { editAccount, onSuccess, accounts } = props;
  const api = useApi();
  const user = useAuth0User();
  const rolesResp = useQuery<AccountRole[]>(ROLES_LIST(), async () => {
    return await api.getRoles();
  });

  const branding = getBranding();
  const settings = useSettings();
  const maxSeats = settings.limits?.seats;

  const isEdit = editAccount !== null;

  // todo: i18n
  const isInviteDisabled = useIsInviteDisabled();

  const isEscalationsEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const isMultiEscalationsEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

  const defaultValues = useMemo(() => {
    if (editAccount) {
      return {
        name: editAccount?.name || '',
        ...(isEscalationsEnabled && {
          escalationLevel: editAccount?.escalationLevel || undefined,
          isReviewer: editAccount.isReviewer ?? false,
          reviewerId: !editAccount.escalationLevel ? editAccount?.reviewerId : undefined,
          escalationReviewerId:
            editAccount.escalationLevel === 'L1' && isMultiEscalationsEnabled
              ? editAccount?.escalationReviewerId
              : undefined,
        }),
        role: editAccount?.role || 'admin',
        email: editAccount?.email || '',
        id: editAccount?.id,
      };
    } else {
      return defaultState;
    }
  }, [isEscalationsEnabled, editAccount, isMultiEscalationsEnabled]);

  const [values, setValues] = useState<Partial<Account>>(defaultValues);

  const [isReviewRequired, setIsReviewRequired] = useState(values.reviewerId != null);

  const editAccountChanged = useIsChanged(editAccount);
  useEffect(() => {
    if (editAccountChanged) {
      if (editAccount) {
        setIsReviewRequired(editAccount?.reviewerId != null);
      } else {
        setIsReviewRequired(false);
      }
      setValues(defaultValues);
    }
  }, [editAccountChanged, editAccount, defaultValues, isEscalationsEnabled]);

  const allRequiredFieldsFilled = useMemo(() => {
    return REQUIRED_FIELDS.every((field) => values[field] !== '' && values[field] !== undefined);
  }, [values]);

  const invalidateUsers = useInvalidateUsers();

  const isInviteButtonDisabled = useMemo(() => {
    if (isEdit) {
      return false;
    }

    if (isInviteDisabled) {
      return true;
    }
    if (!allRequiredFieldsFilled) {
      return true;
    }
    return false;
  }, [isInviteDisabled, allRequiredFieldsFilled, isEdit]);

  let hide: CloseMessage | undefined;

  const inviteMutation = useMutation<unknown, unknown, AccountInvitePayload>(
    async (payload) => {
      if (isReviewRequired && !payload.reviewerId) {
        message.error('Checker is required');
        hide?.();
        return;
      }

      if (!payload.email || !isValidEmail(payload.email)) {
        message.error('Invalid email format');
        hide?.();
        return;
      }

      if (
        values.escalationLevel === 'L1' &&
        isMultiEscalationsEnabled &&
        !values.escalationReviewerId
      ) {
        message.error('Escalation L2 is required');
        hide?.();
        return;
      }

      return await api.accountsInvite({ AccountInvitePayload: payload });
    },
    {
      onSuccess: async (data) => {
        if (!data) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000)); // sleep for 3 seconds to let the account get synced
        message.success('User invited!');
        onSuccess();
        hide?.();
        invalidateUsers.invalidate();
      },
      onError: (e) => {
        message.fatal(`Failed to invite user - ${getErrorMessage(e)}`, e);
        hide?.();
      },
      onMutate: () => {
        hide = message.loading('Sending invitation...');
      },
    },
  );

  const editMutation = useMutation<
    unknown,
    unknown,
    { accountId: string; AccountPatchPayload: AccountPatchPayload }
  >(
    async (payload) => {
      const accountId = payload.accountId;
      if (isReviewRequired && !payload.AccountPatchPayload.reviewerId) {
        message.error('Checker is required');
        hide?.();
        return;
      }

      if (
        values.escalationLevel === 'L1' &&
        isMultiEscalationsEnabled &&
        !values.escalationReviewerId
      ) {
        message.error('Escalation L2 is required');
        hide?.();
        return;
      }

      // if any account has already this reviewerId, then we should not allow to change it
      const isReviewerIdAlreadyUsed = accounts.some((account) => account.reviewerId === accountId);

      if (isReviewerIdAlreadyUsed && !payload.AccountPatchPayload.isReviewer) {
        message.error('This checker is already assigned to a maker');
        hide?.();
        return;
      }

      const isEscalationReviewerIdAlreadyUsed = accounts.some(
        (account) => account.escalationReviewerId === accountId && account.escalationLevel === 'L1',
      );

      if (isEscalationReviewerIdAlreadyUsed && values.escalationLevel === 'L1') {
        message.error('This escalation L2 is already assigned to a maker');
        hide?.();
        return;
      }

      return await api.accountsEdit(payload);
    },
    {
      onSuccess: (data) => {
        if (!data) {
          return;
        }
        message.success('Account updated!');
        onSuccess();
        hide?.();
        invalidateUsers.invalidate();
      },
      onError: (e) => {
        message.fatal(`Failed to update account - ${getErrorMessage(e)}`, e);
        hide?.();
      },
      onMutate: () => {
        hide = message.loading('Updating account...');
      },
    },
  );

  const resendInviteMutation = useMutation<unknown, unknown, { accountId: string; email: string }>(
    async (payload) => {
      return await api.accountsResendInvite({
        accountId: payload.accountId,
        ResendAccountInvitePayload: { email: payload.email },
      });
    },
    {
      onSuccess: () => {
        message.success('Invitation resent!');
        onSuccess();
        hide?.();
      },
      onError: (e) => {
        message.fatal(`Failed to resend invitation - ${getErrorMessage(e)}`, e);
        hide?.();
      },
      onMutate: () => {
        hide = message.loading('Resending invitation...');
      },
    },
  );

  const assignments = useMemo(() => {
    if (values.reviewerId && !values.escalationLevel) {
      return [{ assigneeUserId: values.reviewerId, assignedByUserId: '', timestamp: 0 }];
    }

    if (values.escalationReviewerId && values.escalationLevel === 'L1') {
      return [{ assigneeUserId: values.escalationReviewerId, assignedByUserId: '', timestamp: 0 }];
    }

    return [];
  }, [values.escalationLevel, values.escalationReviewerId, values.reviewerId]);

  const resetPasswordMutation = useMutation<unknown, unknown, { accountId: string }>(
    async (payload) => {
      return await api.accountsResetPassword({ accountId: payload.accountId });
    },
    {
      onSuccess: () => {
        message.success('Password reset!');
        onSuccess();
        hide?.();
      },
      onError: (e) => {
        message.fatal(`Failed to reset password - ${getErrorMessage(e)}`, e);
        hide?.();
      },
      onMutate: () => {
        hide = message.loading('Resetting password...');
      },
    },
  );

  const onFinish = async () => {
    const { email, ...payload } = values;

    if (isEdit) {
      editMutation.mutate({
        accountId: editAccount?.id,
        AccountPatchPayload: {
          ...payload,
          escalationReviewerId:
            payload.escalationLevel === 'L1' && isMultiEscalationsEnabled
              ? payload.escalationReviewerId
              : undefined,
          reviewerId: !payload.escalationLevel ? payload.reviewerId : undefined,
        },
      });
      return;
    }

    if (email == null) {
      throw new Error(`email can not be null`);
    }
    inviteMutation.mutate({ email: email.trim(), ...payload });
  };

  return (
    <Drawer
      title={isEdit ? 'Edit account' : 'Invite user'}
      drawerMaxWidth={'400px'}
      isVisible={props.isVisibile}
      onChangeVisibility={props.onChangeVisibility}
      hasChanges={!isEqual(values, defaultValues)}
      footerRight={
        <>
          <Button
            type="TETRIARY"
            style={{ marginRight: '0.5rem' }}
            isLoading={inviteMutation.isLoading || editMutation.isLoading}
            onClick={() => {
              props.onChangeVisibility(false);
            }}
          >
            Cancel
          </Button>
          <Button
            testName="accounts-invite"
            type="PRIMARY"
            onClick={onFinish}
            isDisabled={isInviteButtonDisabled}
            isLoading={inviteMutation.isLoading || editMutation.isLoading}
            requiredPermissions={['accounts:overview:write']}
          >
            {isEdit ? 'Save' : 'Invite'}
          </Button>
        </>
      }
    >
      <div className={s.container}>
        <Label label="Email" level={4}>
          <TextInput
            testName="accounts-email"
            isDisabled={isEdit}
            allowClear={false}
            value={values.email}
            onChange={(value) => {
              setValues({ ...values, email: value });
            }}
          />
        </Label>
        <AsyncResourceRenderer resource={rolesResp.data}>
          {(roles) => (
            <Label label="Role" level={4}>
              <Select
                allowClear={false}
                options={roles.map((name) => ({ value: name.name, label: startCase(name.name) }))}
                value={values.role}
                onChange={(value) => {
                  setValues({ ...values, role: value });
                }}
                isDisabled={user.userId === editAccount?.id || editAccount?.role == 'root'}
              />
            </Label>
          )}
        </AsyncResourceRenderer>
        <Feature name="ADVANCED_WORKFLOWS">
          <div>
            <P style={{ color: COLORS.purpleGray.base, fontSize: 14, marginBottom: '0.5rem' }}>
              Review permissions
            </P>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <Label position="RIGHT" label="Maker" level={2}>
                <Checkbox
                  value={isReviewRequired}
                  onChange={() => {
                    setIsReviewRequired((prev) => {
                      setValues({ ...values, ...defaultEscalationsState });
                      return !prev;
                    });
                  }}
                />
              </Label>
              <Label position="RIGHT" label="Checker" level={2}>
                <Checkbox
                  value={values.isReviewer ?? false}
                  onChange={(value) => {
                    setValues({
                      ...values,
                      ...defaultEscalationsState,
                      isReviewer: value,
                    });
                    setIsReviewRequired(false);
                  }}
                />
              </Label>
              <Label
                position="RIGHT"
                label={isMultiEscalationsEnabled ? 'Escalation L1' : 'Escalation reviewer'}
                level={2}
              >
                <Checkbox
                  value={values.escalationLevel === 'L1'}
                  onChange={(value) => {
                    setValues({
                      ...values,
                      ...defaultEscalationsState,
                      escalationLevel: value ? 'L1' : undefined,
                      reviewerId: value ? values.reviewerId : undefined,
                    });
                    setIsReviewRequired(false);
                  }}
                />
              </Label>
              <Feature name="MULTI_LEVEL_ESCALATION">
                <Label position="RIGHT" label="Escalation L2" level={2}>
                  <Checkbox
                    value={values.escalationLevel === 'L2'}
                    onChange={(value) => {
                      setValues({
                        ...values,
                        ...defaultEscalationsState,
                        escalationLevel: value ? 'L2' : undefined,
                      });
                      setIsReviewRequired(false);
                    }}
                  />
                </Label>
              </Feature>
            </div>
          </div>
        </Feature>
        {isEscalationsEnabled &&
          (isReviewRequired || (isMultiEscalationsEnabled && values.escalationLevel === 'L1')) && (
            <div style={{ marginTop: '1rem' }}>
              <Label label={values.escalationLevel === 'L1' ? 'Escalation L2 reviewer' : 'Checker'}>
                <AssigneesDropdown
                  maxAssignees={1}
                  editing={true}
                  placeholder={
                    values.escalationLevel === 'L1'
                      ? 'Select a escalation L2 reviewer'
                      : 'Select a checker'
                  }
                  customFilter={(option) => {
                    if (values.escalationLevel === 'L1') {
                      return option.escalationLevel === 'L2';
                    }

                    return option.isReviewer ?? false;
                  }}
                  assignments={assignments}
                  onChange={(value) => {
                    if (values.escalationLevel === 'L1') {
                      setValues({ ...values, escalationReviewerId: value[0] });
                      return;
                    }

                    setValues({ ...values, reviewerId: value[0] });
                  }}
                  requiredPermissions={['accounts:overview:write']}
                />
              </Label>
            </div>
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
        {isInviteDisabled === true && (
          <P variant="m" fontWeight="normal">
            You have reached maximum no. of Seats ({maxSeats}). Please contact support at{' '}
            <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a> if you want
            additional seats
          </P>
        )}
        {isInviteDisabled === null && (
          <P variant="m" fontWeight="normal">
            Loading existing accounts to check maximum no. of Seats...
          </P>
        )}
      </div>
    </Drawer>
  );
}
