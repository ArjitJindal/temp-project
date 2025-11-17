import { useRef, useState } from 'react';
import Modal from '@/components/library/Modal';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import { message } from '@/components/library/Message';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { AsyncResource, isLoading } from '@/utils/asyncResource';

type FormValues = {
  name: string;
  description: string;
};

const initialValues: FormValues = {
  name: '',
  description: '',
};

interface Props {
  initialValues?: FormValues;
  progressRes: AsyncResource;
  onConfirm: (values: FormValues) => Promise<void>;
  children: (props: { onOpenModal: () => void }) => React.ReactNode;
}

export default function PublishModal(props: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const formRef = useRef<FormRef<FormValues>>();
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isValid, setIsValid] = useState(true);
  return (
    <>
      <Modal
        title={'New workflow details'}
        isOpen={isVisible}
        onCancel={() => {
          setIsVisible(false);
          setAlwaysShowErrors(false);
        }}
        onOk={() => {
          formRef.current?.submit();
        }}
        okProps={{
          isDisabled: !isValid,
          isLoading: isLoading(props.progressRes),
        }}
      >
        <Form<FormValues>
          ref={formRef}
          initialValues={props.initialValues ?? initialValues}
          alwaysShowErrors={alwaysShowErrors}
          onChange={({ isValid }) => {
            setIsValid(isValid);
          }}
          fieldValidators={{
            name: notEmpty,
            description: notEmpty,
          }}
          onSubmit={(values, { isValid }) => {
            if (!isValid) {
              message.warn('Please make sure all the fields are filled in correctly');
              setAlwaysShowErrors(true);
              return;
            }
            props.onConfirm(values).then(() => {
              setIsVisible(false);
              setAlwaysShowErrors(false);
            });
          }}
        >
          <InputField<FormValues, 'name'> name={'name'} label={'Name'}>
            {(inputProps) => <TextInput {...inputProps} />}
          </InputField>
          <InputField<FormValues, 'description'> name={'description'} label={'Description'}>
            {(inputProps) => <TextInput {...inputProps} />}
          </InputField>
        </Form>
      </Modal>
      {props.children({
        onOpenModal: () => {
          setIsVisible(true);
        },
      })}
    </>
  );
}
