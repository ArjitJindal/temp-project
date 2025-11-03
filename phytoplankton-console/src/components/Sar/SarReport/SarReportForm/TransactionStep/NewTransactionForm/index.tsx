import s from './index.module.less';
import Button from '@/components/library/Button';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { useId } from '@/utils/hooks';
import Select, { Option } from '@/components/library/Select';

type FormValues = { transactionId?: string };

interface Props {
  onSubmit: (formValues: FormValues) => void;
  transactionIds: Option<string>[];
}

export default function NewTransactionForm(props: Props) {
  const { onSubmit, transactionIds } = props;
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
            {(props) => <Select<string> {...props} allowClear={true} options={transactionIds} />}
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
