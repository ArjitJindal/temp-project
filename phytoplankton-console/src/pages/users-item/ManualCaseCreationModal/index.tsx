import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { compact } from 'lodash';
import { Case, CaseReasons, CasesUsersUserIdResponse, FileInfo, Priority } from '@/apis';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import Modal from '@/components/library/Modal';
import Select from '@/components/library/Select';
import TextArea from '@/components/library/TextArea';
import TextInput from '@/components/library/TextInput';
import { OTHER_REASON } from '@/components/Narrative';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';
import { CASES_USERS_CASEIDS } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import Label from '@/components/library/Label';

type Props = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userId: string;
  type: 'CREATE' | 'EDIT';
  transactionIds?: string[];
};

type FormValues = {
  reason?: CaseReasons;
  otherReason?: string;
  files: FileInfo[];
  comment?: string;
  existingCaseId?: string;
  priority?: Priority;
};

const INITIAL_VALUES: FormValues = {
  reason: undefined,
  otherReason: undefined,
  files: [],
  comment: undefined,
  priority: 'P1',
};

const MANUAL_CASE_CREATION_REASONSS: readonly CaseReasons[] = [
  'Internal referral',
  'External referral',
  'Other',
];

export const MannualCaseCreationModal = (props: Props) => {
  const { isOpen, setIsOpen, type, transactionIds } = props;
  const ref = useRef<FormRef<FormValues>>(null);
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: INITIAL_VALUES,
    isValid: false,
  });
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  const isOtherReason = useMemo(() => {
    return formState.values.reason === OTHER_REASON;
  }, [formState.values.reason]);
  const [fileList, setFileList] = useState<FileInfo[]>(INITIAL_VALUES.files);

  const api = useApi();

  let messageLoading: CloseMessage | undefined;

  const existingCaseIds = useQuery<CasesUsersUserIdResponse>(
    CASES_USERS_CASEIDS({ userId: props.userId, caseType: 'MANUAL' }),
    async () => await api.getCaseIds({ userId: props.userId, filterCaseTypes: 'MANUAL' }),
  );

  const createMutation = useMutation(
    async (values: FormValues) => {
      const { files, comment, otherReason, reason } = values;
      messageLoading = message.loading('Creating case...');
      const case_ = await api.postCasesManual({
        ManualCaseCreationDataRequest: {
          manualCaseData: {
            comment,
            reason: reason ? [reason] : [],
            otherReason,
            userId: props.userId,
            timestamp: Date.now(),
          },
          files: files?.length ? files : [],
          transactionIds: transactionIds ?? [],
          priority: values.priority,
        },
      });

      return case_;
    },
    {
      onSuccess: (data) => {
        message.success(`Case ${data.caseId} created successfully`);
        setIsOpen(false);
        messageLoading?.();
      },
      onError: (error) => {
        message.error(`Error creating case: ${(error as Error).message}`);
        messageLoading?.();
      },
    },
  );

  const editMutation = useMutation<Case | undefined, Error, FormValues>(
    async (values) => {
      const { files, comment, existingCaseId } = values;

      if (!transactionIds?.length) {
        message.warn('No transaction IDs to add to case');
        return;
      }

      if (!existingCaseId) {
        message.error('Please select a case ID');
        return;
      }

      messageLoading = message.loading('Editing case...');

      return await api.patchCasesManual({
        ManualCasePatchRequest: {
          caseId: existingCaseId,
          comment: comment ?? '',
          files: files?.length ? files : [],
          transactionIds,
        },
      });
    },
    {
      onSuccess: (data) => {
        message.success(`Case ${data?.caseId} edited successfully`);
        setIsOpen(false);
        messageLoading?.();
      },
      onError: (error) => {
        message.error(`Error editing case: ${(error as Error).message}`);
        messageLoading?.();
      },
    },
  );

  useEffect(() => {
    setFormState((prevState) => ({
      ...prevState,
      values: {
        ...prevState.values,
        files: fileList,
      },
    }));
  }, [fileList]);

  return (
    <Modal
      isOpen={isOpen}
      onCancel={() => {
        setIsOpen(false);
      }}
      title={`${type === 'CREATE' ? 'Create a manual case' : 'Add to an existing case'}`}
      width="S"
      onOk={() => {
        setAlwaysShowErrors(true);

        if (formState.isValid) {
          if (type === 'CREATE') {
            createMutation.mutate(formState.values);
          } else if (type === 'EDIT') {
            editMutation.mutate(formState.values);
          }
        }
      }}
      writePermissions={['case-management:case-details:write']}
      okText={type === 'CREATE' ? 'Create' : 'Add'}
    >
      <Form<FormValues>
        initialValues={INITIAL_VALUES}
        ref={ref}
        onChange={setFormState}
        fieldValidators={{
          reason: type === 'CREATE' ? notEmpty : undefined,
          comment: notEmpty,
          otherReason: isOtherReason && type === 'CREATE' ? notEmpty : undefined,
          existingCaseId: type === 'EDIT' ? notEmpty : undefined,
        }}
        alwaysShowErrors={alwaysShowErrors}
      >
        {type === 'CREATE' && (
          <InputField<FormValues, 'reason'>
            name="reason"
            label="Reason"
            labelProps={{
              required: {
                showHint: true,
                value: true,
              },
            }}
          >
            {(inputProps) => (
              <Select
                {...inputProps}
                options={MANUAL_CASE_CREATION_REASONSS.map((reason: CaseReasons) => ({
                  label: reason,
                  value: reason,
                }))}
                mode="SINGLE"
              />
            )}
          </InputField>
        )}

        {type === 'CREATE' && isOtherReason && (
          <InputField<FormValues, 'otherReason'>
            name="otherReason"
            label="Describe the reason"
            labelProps={{
              required: {
                value: true,
                showHint: true,
              },
            }}
          >
            {(inputProps) => <TextInput {...inputProps} />}
          </InputField>
        )}

        {type === 'CREATE' && (
          <InputField<FormValues, 'priority'>
            name="priority"
            label="Priority"
            labelProps={{
              required: {
                value: true,
                showHint: true,
              },
            }}
          >
            {(inputProps) => (
              <Select<Priority>
                {...inputProps}
                options={PRIORITYS.map((priority) => ({
                  label: priority,
                  value: priority,
                }))}
                mode="SINGLE"
              />
            )}
          </InputField>
        )}

        {type === 'EDIT' && (
          <InputField<FormValues, 'existingCaseId'>
            name="existingCaseId"
            label="Case ID"
            labelProps={{
              required: {
                value: true,
                showHint: true,
              },
            }}
          >
            {(inputProps) => (
              <Select
                {...inputProps}
                options={compact(getOr(existingCaseIds.data, { caseIds: [] }).caseIds).map(
                  (caseId) => ({
                    label: caseId,
                    value: caseId,
                  }),
                )}
                mode="SINGLE"
              />
            )}
          </InputField>
        )}

        <InputField<FormValues, 'comment'>
          name={'comment'}
          label={'Comment'}
          labelProps={{
            required: {
              value: true,
              showHint: true,
            },
          }}
        >
          {(inputProps) => (
            <>
              <TextArea
                {...inputProps}
                rows={4}
                placeholder={`Write a narrative explaining the reson for ${
                  type === 'CREATE' ? 'creating a new case' : 'adding transactions to this case'
                }`}
              />
            </>
          )}
        </InputField>

        <Label label={'Upload attachments'}>
          <FilesDraggerInput
            onChange={(value) => {
              setFileList(value ?? []);
            }}
            value={fileList}
          />
        </Label>
      </Form>
    </Modal>
  );
};
