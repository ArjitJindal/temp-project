import React from 'react';
import GenericFormField from './GenericFormField';
import Form from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/ui/Button';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import { UseFormState } from '@/components/library/Form/utils';

type FormValues = {
  name: string;
  lastName: string;
};

export default function (): JSX.Element {
  return (
    <>
      <UseCase
        title="Generic field"
        description="FormField component is used for connecting form state with actual fields via React contexts"
      >
        <Form<FormValues>
          initialValues={{
            name: '',
            lastName: '',
          }}
          onSubmit={(values) => {
            alert(`Result values: ${JSON.stringify(values)}`);
          }}
        >
          <Container>
            <GenericFormField<FormValues> name="name">
              {({ value, onChange }) => <TextInput value={value} onChange={onChange} />}
            </GenericFormField>
            <Button htmlType="submit">Submit</Button>
          </Container>
        </Form>
      </UseCase>
      <UseCase
        title="Input field"
        description="Special component with label and error messages embedded"
      >
        <Form<FormValues>
          initialValues={{
            name: '',
            lastName: '',
          }}
          onSubmit={(values) => {
            alert(`Result values: ${JSON.stringify(values)}`);
          }}
          fieldValidators={{
            name: (name) => (name.length < 3 ? 'Name should be longer than 2' : null),
          }}
        >
          <Container>
            <InputField<FormValues> name={'name'} label={'User name'} input={TextInput} />
            <UseFormState>
              {({ isValid }) => (
                <Button htmlType="submit" disabled={!isValid}>
                  Submit
                </Button>
              )}
            </UseFormState>
          </Container>
        </Form>
      </UseCase>
      <UseCase
        title="Validation"
        description="It is also possible to provide field-level and form-level validators to check consistency between separate fields if needed"
      >
        <Form<FormValues>
          initialValues={{
            name: '',
            lastName: '',
          }}
          onSubmit={(values) => {
            alert(`Result values: ${JSON.stringify(values)}`);
          }}
          fieldValidators={{
            name: (name) => (name.length < 3 ? 'Name should be longer than 2' : null),
            lastName: (name) => (name.length < 3 ? 'Last name should be longer than 2' : null),
          }}
          formValidators={[
            (values) =>
              values.name && values.name[0] === values.lastName[0]
                ? null
                : 'Name and last name should start with the same letter for some reason',
          ]}
        >
          <Container>
            <InputField<FormValues> name="name" label="First name" input={TextInput} />
            <InputField<FormValues> name="lastName" label="Last name" input={TextInput} />
            <UseFormState>
              {({ isValid }) => (
                <>
                  <Button htmlType="submit" disabled={!isValid}>
                    Submit
                  </Button>
                </>
              )}
            </UseFormState>
            <FormValidationErrors />
          </Container>
        </Form>
      </UseCase>
    </>
  );
}

function Container(props: { children: React.ReactNode }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'self-start' }}
    >
      {props.children}
    </div>
  );
}
