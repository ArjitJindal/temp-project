import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Modal from '../../../../components/library/Modal/index';
import s from './index.module.less';
import { maxLength, notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { and } from '@/components/library/Form/utils/validation/combinators';
import { MAX_COMMENT_LENGTH } from '@/components/CommentEditor';
import InputField from '@/components/library/Form/InputField';
import Form, { FormRef, InputProps } from '@/components/library/Form';
import { CaseReasons, FileInfo, RuleAction } from '@/apis';
import { CASE_REASONSS } from '@/apis/models-custom/CaseReasons';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import TextArea from '@/components/library/TextArea';
import Select from '@/components/library/Select';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';

interface Props {
  visible: boolean;
  transactionIds: string[];
  action: RuleAction;
  hide: () => void;
  onSuccess?: () => void;
}

export interface FormValues {
  reasons: CaseReasons[];
  comment: string;
  files: FileInfo[];
}
export default function PaymentApprovalModal({
  visible,
  action,
  transactionIds,
  hide,
  onSuccess,
}: Props) {
  const formRef = useRef<FormRef<FormValues>>(null);
  const initialValues: FormValues = {
    reasons: [],
    comment: '',
    files: [],
  };
  const api = useApi();
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  const mutation = useMutation(
    async (values: FormValues) =>
      api.applyTransactionsAction({
        TransactionAction: {
          transactionIds,
          comment: values.comment,
          reason: values.reasons,
          files: values.files?.length > 0 ? values.files : [],
          action,
        },
      }),
    {
      onSuccess: () => {
        if (action === 'ALLOW') {
          message.success(
            `Transaction(s) were allowed (It might take a few seconds to be visible in Console)`,
          );
        }
        if (action === 'BLOCK') {
          message.success(
            `Transaction(s) were blocked  (It might take a few seconds to be visible in Console)`,
          );
        }
        onSuccess?.();
        hide();
      },
      onError: (e) => {
        message.error(`Could not update transaction status: ${e}`);
      },
    },
  );

  return (
    <Modal
      title={`${humanizeConstant(action)} transaction`}
      okText={'Confirm'}
      isOpen={visible}
      onOk={() => formRef.current?.submit()}
      onCancel={hide}
    >
      <Form<FormValues>
        ref={formRef}
        initialValues={initialValues}
        className={s.root}
        onSubmit={async (a, state) => {
          setAlwaysShowErrors(true);
          if (state.isValid) {
            mutation.mutate(a);
          }
        }}
        fieldValidators={{
          reasons: notEmpty,
          comment: and([notEmpty, maxLength(MAX_COMMENT_LENGTH)]),
        }}
        alwaysShowErrors={alwaysShowErrors}
      >
        <InputField<FormValues, 'reasons'>
          name={'reasons'}
          label={'Reason'}
          labelProps={{
            required: {
              value: true,
              showHint: true,
            },
          }}
        >
          {(inputProps: InputProps<CaseReasons[]>) => (
            <Select<CaseReasons>
              {...inputProps}
              mode="MULTIPLE"
              options={CASE_REASONSS.map((label) => ({ value: label, label }))}
            />
          )}
        </InputField>
        <div className={s.comment}>
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
              <TextArea
                {...inputProps}
                rows={4}
                placeholder={`Enter your additional comment here, if any.`}
              />
            )}
          </InputField>
        </div>
        <InputField<FormValues, 'files'>
          name={'files'}
          label={'Files'}
          labelProps={{
            required: false,
          }}
        >
          {(inputProps) => <FilesDraggerInput {...inputProps} />}
        </InputField>
      </Form>
    </Modal>
  );
}
