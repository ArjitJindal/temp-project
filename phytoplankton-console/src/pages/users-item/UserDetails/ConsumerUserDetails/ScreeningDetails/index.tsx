import { useRef, useState } from 'react';
import { ScreeningDetailsUpdateForm } from './UpdateForm';
import s from './index.module.less';
import { consolidatePEPStatus, expandPEPStatus } from './PepStatus/utils';
import {
  PepFormValues,
  PepStatusValue,
} from '@/pages/users-item/UserDetails/ConsumerUserDetails/ScreeningDetails/PepStatus';
import { InternalConsumerUser, PEPStatus, UserUpdateRequest } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import Modal from '@/components/library/Modal';
import EditIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import Form from '@/components/library/Form';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';

interface Props {
  user: InternalConsumerUser;
  columns?: number;
}

export interface FormValues {
  pepStatus: Array<PEPStatus>;
  sanctionsStatus?: boolean;
  adverseMediaStatus?: boolean;
}

export default function ScreeningDetails(props: Props) {
  const { user, columns = 1 } = props;
  const [isOpen, setIsOpen] = useState(false);
  const api = useApi();
  const formRef = useRef(null);

  const initialValues = {
    sanctionsStatus:
      user.sanctionsStatus === undefined ? undefined : user.sanctionsStatus ? true : false,
    adverseMediaStatus:
      user.adverseMediaStatus === undefined ? undefined : user.adverseMediaStatus ? true : false,
    pepStatus: user.pepStatus ?? [],
  };

  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: {
      ...initialValues,
      pepStatus: [
        ...((consolidatePEPStatus(initialValues.pepStatus) as PEPStatus[]) ?? []),
        {} as PEPStatus,
      ] as PEPStatus[],
    },
    isValid: false,
  });

  const [pepValidationResult, setPepValidationResult] = useState<string | null>(null);

  const updatePepValidationResult = (error: string | null) => {
    setPepValidationResult(error);
  };

  const userUpdateMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      if (pepValidationResult != null) {
        return;
      }
      // removing the last index - as it is the for adding pep status
      const updates: UserUpdateRequest = {
        pepStatus: expandPEPStatus(
          (formValues.pepStatus.slice(0, formValues.pepStatus.length - 1) as PepFormValues[]) ?? [],
        ),
        adverseMediaStatus: formValues.adverseMediaStatus,
        sanctionsStatus: formValues.sanctionsStatus,
      };
      await api.postConsumerUsersUserId({
        userId: user.userId,
        UserUpdateRequest: updates,
      });
    },
    {
      onSuccess: () => {
        setIsOpen(false);
        message.success(
          'Screening details updated successfully (It might take a few seconds to be visible in Console)',
        );
      },
      onError: () => {
        message.fatal(`Unable to update screening details!`);
      },
    },
  );

  return (
    <EntityPropertiesCard
      title={'Screening details'}
      extraControls={<EditIcon className={s.icon} onClick={() => setIsOpen(true)} />}
      columns={columns}
      items={[
        {
          label: 'PEP Status',
          value: <PepStatusValue pepStatus={initialValues.pepStatus} />,
        },
        {
          label: 'Sanctions status',
          value:
            initialValues.sanctionsStatus === undefined
              ? '-'
              : initialValues.sanctionsStatus
              ? 'Yes'
              : 'No',
        },
        {
          label: 'Adverse media status',
          value:
            initialValues.adverseMediaStatus === undefined
              ? '-'
              : initialValues.adverseMediaStatus
              ? 'Yes'
              : 'No',
        },
      ]}
      modal={
        <Modal
          id={'user-screening-details-update-modal'}
          isOpen={isOpen}
          onCancel={() => setIsOpen(false)}
          onOk={() => {
            if (formState.isValid) {
              userUpdateMutation.mutate(formState.values);
            }
          }}
          title="Screening details"
          width="L"
          maskClosable={false}
          okText="Save"
          okProps={{
            isDisabled: pepValidationResult != null,
          }}
        >
          <div className={s.formContainer}>
            <Form<FormValues>
              ref={formRef}
              initialValues={formState.values}
              onChange={(values) => {
                setFormState(() => ({
                  ...values,
                  isValid: values.isValid,
                  values: {
                    ...values.values,
                  },
                }));
              }}
            >
              <ScreeningDetailsUpdateForm
                size="L"
                updatePepValidationResult={updatePepValidationResult}
              />
            </Form>
          </div>
        </Modal>
      }
    />
  );
}
