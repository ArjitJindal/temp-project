import React, { useRef, useState } from 'react';
import s from './style.module.less';
import Modal from '@/components/library/Modal';
import InputField from '@/components/library/Form/InputField';
import { AsyncResource, isLoading } from '@/utils/asyncResource';
import TextArea from '@/components/library/TextArea';
import Form, { FormRef } from '@/components/library/Form';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { message } from '@/components/library/Message';

export type Confirm = () => void;

type FormValues = {
  comment?: string;
};

export interface Props {
  title?: string;
  text: string | React.ReactNode;
  commentRequired?: boolean;
  res?: AsyncResource;
  isDanger?: boolean;
  isVisible: boolean;
  onConfirm: (formValues: FormValues) => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: Props) {
  const { isVisible, isDanger, title, text, res, onConfirm, onCancel, commentRequired } = props;

  const formRef = useRef<FormRef<FormValues>>(null);

  const [isFormValid, setIsFormValid] = useState(false);

  return (
    <Modal
      width="S"
      title={title ?? 'Confirm action'}
      subTitle={commentRequired ? text : undefined}
      isOpen={isVisible}
      disableInternalBorders={true}
      onCancel={onCancel}
      onOk={() => {
        formRef.current?.submit();
      }}
      maskClosable={res && !isLoading(res)}
      okProps={{
        htmlType: 'submit',
        isDisabled: !isFormValid,
        isLoading: res != null && isLoading(res),
        type: isDanger ? 'DANGER' : undefined,
      }}
      okText="Confirm"
      cancelText="Cancel"
      cancelProps={{
        htmlType: 'button',
        isDisabled: res != null && isLoading(res),
      }}
      testId={'confirmation-modal'}
    >
      <Form
        ref={formRef}
        fieldValidators={{
          comment: commentRequired ? notEmpty : undefined,
        }}
        initialValues={{ comment: '' }}
        onChange={(values) => {
          setIsFormValid(values.isValid);
        }}
        onSubmit={(values, { isValid }) => {
          if (isValid) {
            onConfirm(values);
          } else {
            message.error('Please fix all form errors');
          }
        }}
      >
        {commentRequired ? (
          <InputField<FormValues, 'comment'>
            name="comment"
            label="Comment"
            labelProps={{ required: true }}
          >
            {(inputProps) => <TextArea {...inputProps} />}
          </InputField>
        ) : (
          <div className={s.text}>{text}</div>
        )}
      </Form>
    </Modal>
  );
}
