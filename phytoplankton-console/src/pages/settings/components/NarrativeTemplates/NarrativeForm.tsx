import { FormValues } from './type';
import Button from '@/components/library/Button';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';

type FormProps = {
  values: FormValues;
  onSubmit: (values: FormValues) => void;
  submitRef: React.RefObject<HTMLButtonElement>;
  formRef?: React.RefObject<FormRef<FormValues>>;
};

const NarrativeForm = (props: FormProps) => {
  const { values, onSubmit, submitRef, formRef } = props;

  return (
    <Form<FormValues>
      initialValues={values}
      onSubmit={(values) => {
        onSubmit(values);
      }}
      ref={formRef}
    >
      <InputField<FormValues, 'name'>
        name={'name'}
        label={'Name'}
        labelProps={{ isOptional: false, element: 'div' }}
      >
        {(inputProps) => <TextInput {...inputProps} placeholder={'Enter name'} />}
      </InputField>
      <div style={{ marginTop: '16px' }}>
        <InputField<FormValues, 'description'>
          name={'description'}
          label={'Description'}
          labelProps={{ isOptional: false }}
        >
          {(inputProps) => (
            <TextArea
              onChange={(value) => {
                if (value != null && inputProps?.onChange) {
                  inputProps.onChange(value);
                }
              }}
              value={inputProps.value || ''}
              showCount
              maxLength={5000}
              placeholder={'Enter narrative description here...'}
              rows={6}
            />
          )}
        </InputField>
      </div>
      <Button
        type="PRIMARY"
        size="MEDIUM"
        style={{ display: 'none' }}
        htmlType="submit"
        ref={submitRef}
      >
        Create template
      </Button>
    </Form>
  );
};

export default NarrativeForm;
