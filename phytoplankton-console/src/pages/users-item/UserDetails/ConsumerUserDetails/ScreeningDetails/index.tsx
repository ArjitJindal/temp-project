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
import { isLoading } from '@/utils/asyncResource';

interface Props {
  user: InternalConsumerUser;
  columns?: number;
}

export interface FormValues {
  pepStatus: Array<PEPStatus>;
  sanctionsStatus?: boolean;
  adverseMediaStatus?: boolean;
}

const screeningDetailsKeys = (userId: string) => `${userId}_screeningDetails`;

const writeUpdatesToLocalStorage = (userId: string, value: FormValues) => {
  window.localStorage.setItem(
    screeningDetailsKeys(userId),
    JSON.stringify({ ...value, timestamp: Date.now() }),
  );
};

const getUpdatesFromLocalStorage = (userId: string): FormValues | null => {
  const value = window.localStorage.getItem(screeningDetailsKeys(userId));
  if (value) {
    const parsedValue = JSON.parse(value);
    if (parsedValue.timestamp && parsedValue.timestamp > Date.now() - 1000 * 60 * 60) {
      // discard 1 minutes old updates
      return parsedValue;
    }
  }
  window.localStorage.removeItem(screeningDetailsKeys(userId));
  return null;
};

const deriveScreeningDetails = (user: InternalConsumerUser) => {
  return {
    sanctionsStatus:
      user.sanctionsStatus === undefined ? undefined : user.sanctionsStatus ? true : false,
    adverseMediaStatus:
      user.adverseMediaStatus === undefined ? undefined : user.adverseMediaStatus ? true : false,
    pepStatus: user.pepStatus ?? [],
  };
};

const getInitialValue = (user: InternalConsumerUser) => {
  const localStorageScreeningDetails = getUpdatesFromLocalStorage(user.userId);
  if (localStorageScreeningDetails) {
    return localStorageScreeningDetails;
  }
  return deriveScreeningDetails(user);
};

export default function ScreeningDetails(props: Props) {
  const { user, columns = 1 } = props;
  const [isOpen, setIsOpen] = useState(false);
  const api = useApi();
  const formRef = useRef(null);

  // reading data from local storage, adhock fix as screening detail updates go through CDC,
  // there is delay in updating the console, so we are optimistically updating the ui state
  // and stroing the updates in local storage with TTL 1 minute to account for ui refreshes
  const [screeningDetails, setScreeningDetails] = useState<FormValues>(getInitialValue(user));

  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: {
      ...screeningDetails,
      pepStatus: [
        ...((consolidatePEPStatus(screeningDetails.pepStatus) as PEPStatus[]) ?? []),
        {} as PEPStatus,
      ] as PEPStatus[],
    },
    isValid: false,
  });

  const [pepValidationResult, setPepValidationResult] = useState<string | null>(null);

  const updatePepValidationResult = (error: string | null) => {
    setPepValidationResult(error);
  };

  const userUpdateMutation = useMutation<FormValues, unknown, FormValues>(
    async (formValues) => {
      if (pepValidationResult !== null) {
        return screeningDetails;
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
      return formValues;
    },
    {
      onSuccess: (formValues) => {
        message.success(
          'Screening details updated successfully (It might take a few seconds to be visible in Console)',
        );
        // form submitted successfully
        setScreeningDetails(() => {
          const newState = {
            ...formValues,
            pepStatus: expandPEPStatus(
              (formValues.pepStatus.slice(0, formValues.pepStatus.length - 1) as PepFormValues[]) ??
                [],
            ),
          };
          writeUpdatesToLocalStorage(user.userId, newState);
          return newState;
        });
        setIsOpen(false);
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
          value: <PepStatusValue pepStatus={screeningDetails.pepStatus} />, // check this
        },
        {
          label: 'Sanctions status',
          value:
            screeningDetails.sanctionsStatus === undefined
              ? '-'
              : screeningDetails.sanctionsStatus
              ? 'Yes'
              : 'No',
        },
        {
          label: 'Adverse media status',
          value:
            screeningDetails.adverseMediaStatus === undefined
              ? '-'
              : screeningDetails.adverseMediaStatus
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
          maskClosable={!isLoading(userUpdateMutation.dataResource)}
          okText="Save"
          okProps={{
            isDisabled:
              pepValidationResult !== null ||
              !formState.isValid ||
              isLoading(userUpdateMutation.dataResource),
          }}
          cancelProps={{
            isDisabled: isLoading(userUpdateMutation.dataResource),
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
                isLoading={isLoading(userUpdateMutation.dataResource)}
              />
            </Form>
          </div>
        </Modal>
      }
    />
  );
}
