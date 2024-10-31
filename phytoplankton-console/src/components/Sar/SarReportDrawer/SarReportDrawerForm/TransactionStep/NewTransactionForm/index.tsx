import s from './index.module.less';
import TextInput from '@/components/library/TextInput';
import Button from '@/components/library/Button';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { useId } from '@/utils/hooks';

type FormValues = { transactionId?: string };

interface Props {
  onSubmit: (formValues: FormValues) => void;
}

export default function NewTransactionForm(props: Props) {
  const { onSubmit } = props;
  const formId = useId(`new-transaction-form-`);
  return (
    <Form<FormValues>
      id={formId}
      portaled
      initialValues={{}}
      fieldValidators={{
        transactionId: notEmpty,
      }}
      onSubmit={onSubmit}
    >
      {({ validationResult }) => (
        <div className={s.root}>
          <InputField<FormValues, 'transactionId'> name={'transactionId'} label={'Transaction ID'}>
            {(props) => <TextInput {...props} htmlAttrs={{ form: formId }} />}
          </InputField>
          <Button
            isDisabled={validationResult != null}
            htmlType={'submit'}
            htmlAttrs={{
              form: formId,
            }}
          >
            Add
          </Button>
        </div>
      )}
    </Form>
  );
}
