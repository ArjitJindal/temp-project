import React from 'react';
import GenericFormField from './GenericFormField';
import Form from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';
import BasicInputField from '@/components/library/Form/BasicInputField';
import TextInput from '@/components/library/TextInput';
import { UseFormState } from '@/components/library/Form/utils';
import NumberInput from '@/components/library/NumberInput';
import NestedForm from '@/components/library/Form/NestedForm';
import { and } from '@/components/library/Form/utils/validation/combinators';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';

type FormValues = {
  name: string;
  lastName: string;
};

interface NestedFormValues {
  age: number;
  personal: {
    nickname: string;
    name: {
      firstName: string;
      lastName: string;
    };
  };
}

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
            name: (name = '') => (name.length < 3 ? 'Name should be longer than 2' : null),
          }}
        >
          <Container>
            <BasicInputField<FormValues> name={'name'} label={'User name'} input={TextInput} />
            <UseFormState>
              {({ isValid }) => (
                <Button htmlType="submit" isDisabled={!isValid}>
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
            name: (name = '') => (name.length < 3 ? 'Name should be longer than 2' : null),
            lastName: (name = '') => (name.length < 3 ? 'Last name should be longer than 2' : null),
          }}
          formValidators={[
            (values) =>
              values.name && values.name[0] === values.lastName[0]
                ? null
                : 'Name and last name should start with the same letter for some reason',
          ]}
        >
          <Container>
            <BasicInputField<FormValues> name="name" label="First name" input={TextInput} />
            <BasicInputField<FormValues> name="lastName" label="Last name" input={TextInput} />
            <UseFormState>
              {({ isValid }) => (
                <>
                  <Button htmlType="submit" isDisabled={!isValid}>
                    Submit
                  </Button>
                </>
              )}
            </UseFormState>
            <FormValidationErrors />
          </Container>
        </Form>
      </UseCase>
      <UseCase title="Nested forms">
        <Form<NestedFormValues>
          initialValues={{
            age: 35,
            personal: {
              nickname: '',
              name: {
                firstName: '',
                lastName: '',
              },
            },
          }}
          onSubmit={(values) => {
            alert(`Result values: ${JSON.stringify(values)}`);
          }}
          fieldValidators={{
            age: and([notEmpty, (age) => (age == null || age < 18 ? 'You must be adult' : null)]),
            personal: {
              nickname: (name = '') =>
                name.length < 3 ? 'Nick name should be longer than 2' : null,
              name: {
                firstName: (name = '') => (name.length < 3 ? 'Name should be longer than 2' : null),
                lastName: (name = '') =>
                  name.length < 3 ? 'Last name should be longer than 2' : null,
              },
            },
          }}
        >
          <Container>
            <BasicInputField<NestedFormValues, 'age'>
              name="age"
              label="First name"
              input={NumberInput}
            />
            <NestedForm name={'personal'}>
              <BasicInputField<NestedFormValues['personal'], 'nickname'>
                name="nickname"
                label="Nickname"
                input={TextInput}
              />
              <NestedForm name={'name'}>
                <BasicInputField<NestedFormValues['personal']['name']>
                  name="firstName"
                  label="First name"
                  input={TextInput}
                />
                <BasicInputField<NestedFormValues['personal']['name']>
                  name="lastName"
                  label="Last name"
                  input={TextInput}
                />
              </NestedForm>
            </NestedForm>
            <UseFormState>
              {({ isValid }) => (
                <>
                  <Button htmlType="submit" isDisabled={!isValid}>
                    Submit
                  </Button>
                </>
              )}
            </UseFormState>
            <FormValidationErrors />
          </Container>
        </Form>
      </UseCase>
      <UseCase
        title="Always show errors"
        description="Special mode to show all the fields validation errors before fields got visited"
      >
        <Form<NestedFormValues>
          alwaysShowErrors={true}
          initialValues={{
            age: 35,
            personal: {
              nickname: '',
              name: {
                firstName: '',
                lastName: '',
              },
            },
          }}
          onSubmit={(values) => {
            alert(`Result values: ${JSON.stringify(values)}`);
          }}
          fieldValidators={{
            age: and([notEmpty, (age) => (age == null || age < 18 ? 'You must be adult' : null)]),
            personal: {
              nickname: (name = '') =>
                name.length < 3 ? 'Nick name should be longer than 2' : null,
              name: {
                firstName: (name = '') => (name.length < 3 ? 'Name should be longer than 2' : null),
                lastName: (name = '') =>
                  name.length < 3 ? 'Last name should be longer than 2' : null,
              },
            },
          }}
        >
          <Container>
            <BasicInputField<NestedFormValues, 'age'>
              name="age"
              label="First name"
              input={NumberInput}
            />
            <NestedForm name={'personal'}>
              <BasicInputField<NestedFormValues['personal'], 'nickname'>
                name="nickname"
                label="Nickname"
                input={TextInput}
              />
              <NestedForm name={'name'}>
                <BasicInputField<NestedFormValues['personal']['name']>
                  name="firstName"
                  label="First name"
                  input={TextInput}
                />
                <BasicInputField<NestedFormValues['personal']['name']>
                  name="lastName"
                  label="Last name"
                  input={TextInput}
                />
              </NestedForm>
            </NestedForm>
            <UseFormState>
              {({ isValid }) => (
                <>
                  <Button htmlType="submit" isDisabled={!isValid}>
                    Submit
                  </Button>
                </>
              )}
            </UseFormState>
            <FormValidationErrors />
          </Container>
        </Form>
      </UseCase>
      <UseCase
        title="Pre-defined meta"
        description="It is possible to pre-define meta for fields to add required meta properties"
      >
        <Form<NestedFormValues>
          initialValues={{
            age: 35,
            personal: {
              nickname: '',
              name: {
                firstName: '',
                lastName: '',
              },
            },
          }}
          initialMeta={{
            age: {
              highlight: 'Sample highlight text for "age"',
            },
            personal: {
              children: {
                nickname: {
                  highlight: 'Sample highlight text for "nickname"',
                },
                name: {
                  children: {
                    firstName: {
                      highlight: 'Sample highlight text for "firstName"',
                    },
                    lastName: {
                      highlight: 'Sample highlight text for "lastName"',
                    },
                  },
                },
              },
            },
          }}
          onSubmit={(values) => {
            alert(`Result values: ${JSON.stringify(values)}`);
          }}
        >
          <Container>
            <BasicInputField<NestedFormValues, 'age'>
              name={'age'}
              label={'Age'}
              input={NumberInput}
            />
            <NestedForm name={'personal'}>
              <BasicInputField<NestedFormValues['personal'], 'nickname'>
                name="nickname"
                label="Nickname"
                input={TextInput}
              />
              <NestedForm name={'name'}>
                <BasicInputField<NestedFormValues['personal']['name']>
                  name="firstName"
                  label="First name"
                  input={TextInput}
                />
                <BasicInputField<NestedFormValues['personal']['name']>
                  name="lastName"
                  label="Last name"
                  input={TextInput}
                />
              </NestedForm>
            </NestedForm>
            <Button htmlType="submit">Submit</Button>
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
