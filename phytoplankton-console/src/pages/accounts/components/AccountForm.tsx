import React, { useEffect, useMemo, useState } from 'react';
import { startCase } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import s from './styles.module.less';
import { useIsInviteDisabled } from './utils';
import { CloseMessage, message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { Account, AccountInvitePayload, AccountPatchPayload, AccountRole } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { getErrorMessage } from '@/utils/lang';
import {
  Feature,
  useFeatures,
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

interface Props {
  editAccount: Account | null;
  onSuccess: () => void;
  isVisibile: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
}

const REQUIRED_FIELDS = ['email', 'role'];

const defaultState = {
  name: '',
  isEscalationContact: false,
  reviewerId: undefined,
  role: 'admin',
  email: '',
};

export default function AccountForm(props: Props) {
  const { editAccount, onSuccess } = props;
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

  const [values, setValues] = useState<Partial<Account>>(defaultState);

  const features = useFeatures();

  const isEscalationsEnabled = useMemo(() => features.includes('ADVANCED_WORKFLOWS'), [features]);

  const [isReviewRequired, setIsReviewRequired] = useState(false);

  useEffect(() => {
    if (editAccount) {
      setValues({
        name: editAccount?.name || '',
        ...(isEscalationsEnabled && {
          isEscalationContact: editAccount?.isEscalationContact || false,
          reviewerId: editAccount?.reviewerId || undefined,
        }),
        role: editAccount?.role || 'admin',
        email: editAccount?.email || '',
        id: editAccount?.id,
      });
      setIsReviewRequired(editAccount?.reviewerId != null);
    } else {
      setValues(defaultState);
      setIsReviewRequired(false);
    }
  }, [editAccount, isEscalationsEnabled]);

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
        return;
      }

      return await api.accountsInvite({
        AccountInvitePayload: payload,
      });
    },
    {
      onSuccess: (data) => {
        if (!data) {
          return;
        }
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
      if (isReviewRequired && !payload.AccountPatchPayload.reviewerId) {
        message.error('Checker is required');
        return;
      }
      return await api.accountsEdit(payload);
    },
    {
      onSuccess: () => {
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

  const onFinish = async () => {
    const { email, role, isEscalationContact, reviewerId } = values;
    if (isEdit) {
      editMutation.mutate({
        accountId: editAccount?.id,
        AccountPatchPayload: { role, isEscalationContact, reviewerId },
      });
      return;
    }

    if (email == null) {
      throw new Error(`email can not be null`);
    }
    inviteMutation.mutate({ email: email.trim(), role: role, isEscalationContact, reviewerId });
  };

  return (
    <Drawer
      title={isEdit ? 'Edit account' : 'Invite user'}
      drawerMaxWidth={'400px'}
      isVisible={props.isVisibile}
      onChangeVisibility={props.onChangeVisibility}
      rightAlignButtonsFooter
      footer={
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
            onClick={() => {
              onFinish();
            }}
            isDisabled={isInviteButtonDisabled}
            isLoading={inviteMutation.isLoading || editMutation.isLoading}
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
              setValues({
                ...values,
                email: value,
              });
            }}
          />
        </Label>
        <AsyncResourceRenderer resource={rolesResp.data}>
          {(roles) => (
            <Label label="Role" level={4}>
              <Select
                allowClear={false}
                options={roles.map((name) => ({
                  value: name.name,
                  label: startCase(name.name),
                }))}
                value={values.role}
                onChange={(value) => {
                  setValues({
                    ...values,
                    role: value,
                  });
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
              <Label position="RIGHT" label="Escalation reviewer" level={2}>
                <Checkbox
                  value={values.isEscalationContact}
                  onChange={(value) => {
                    setValues({
                      ...values,
                      isEscalationContact: value,
                    });
                  }}
                />
              </Label>
              <Label position="RIGHT" label="Maker" level={2}>
                <Checkbox
                  value={isReviewRequired}
                  onChange={() => {
                    setIsReviewRequired((prev) => {
                      setValues({
                        ...values,
                        reviewerId: prev ? undefined : values.reviewerId,
                      });
                      return !prev;
                    });
                  }}
                />
              </Label>
            </div>
          </div>
        </Feature>
        {isReviewRequired && isEscalationsEnabled && (
          <div style={{ marginTop: '1rem' }}>
            <Label label="Select a checker">
              <AssigneesDropdown
                maxAssignees={1}
                editing={true}
                placeholder="Select a reviewer"
                assignments={
                  values.reviewerId
                    ? [
                        {
                          assigneeUserId: values.reviewerId,
                          assignedByUserId: '',
                          timestamp: 0,
                        },
                      ]
                    : []
                }
                onChange={(value) => {
                  setValues({ ...values, reviewerId: value[0] });
                }}
              />
            </Label>
          </div>
        )}
        {isEdit && (
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
            requiredPermissions={['settings:organisation:write']}
            style={{ width: 'fit-content' }}
          >
            Resend invitation
          </Button>
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
