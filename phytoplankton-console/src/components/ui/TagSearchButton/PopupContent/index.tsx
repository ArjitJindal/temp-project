import React, { useCallback, useRef } from 'react';
import { Value } from '../types';
import s from './style.module.less';
import { getOr, isLoading } from '@/utils/asyncResource';
import Form, { FormRef } from '@/components/library/Form';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import InputField from '@/components/library/Form/InputField';
import { QueryResult } from '@/utils/queries/types';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';

interface Props {
  keyQueryResult: QueryResult<string[]>;
  valueQueryResult: QueryResult<string[]>;
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
  onChangeFormValues: (newValues: Value) => void;
}

export default function PopupContent(props: Props) {
  const {
    keyQueryResult,
    valueQueryResult,
    initialState,
    onCancel,
    onConfirm,
    onChangeFormValues,
  } = props;

  const formRef = useRef<FormRef<Value>>();

  const [selectedKey, setSelectedKey] = React.useState<string | undefined>(initialState.key);

  const handleKeyChange = useCallback((key: string | undefined) => {
    setSelectedKey(key);
  }, []);

  const handleCancel = useCallback(() => {
    formRef.current?.resetFields();
    onCancel();
  }, [onCancel]);

  return (
    <Form<Value>
      initialValues={initialState}
      ref={formRef}
      formValidators={[
        (formValues) => {
          if (formValues.key == null && formValues.value != null) {
            return `It is not possible to filter by tag's value if tag's key is not specified`;
          }
          return null;
        },
      ]}
      onSubmit={(values) => {
        onConfirm(values);
      }}
      onChange={(values) => {
        onChangeFormValues(values.values);
        setSelectedKey(values.values.key);
      }}
    >
      {({ isFormValid, valuesState }) => {
        const [_, setValues] = valuesState;
        return (
          <div className={s.root}>
            <InputField<Value, 'key'> name={'key'} label={'Tag key'} labelProps={{ level: 2 }}>
              {(inputProps) => (
                <Select
                  {...inputProps}
                  allowClear={true}
                  isLoading={isLoading(keyQueryResult.data)}
                  options={(getOr(keyQueryResult.data, []) as unknown as Array<string>)
                    .filter((key) => key?.length > 0)
                    .map((key) => ({ label: key, value: key }))}
                  value={inputProps.value}
                  onChange={(value) => {
                    handleKeyChange(value);
                    if (inputProps.onChange) {
                      inputProps.onChange(value);
                    }
                    if (value == null || value !== inputProps.value) {
                      setValues((prevValues) => ({
                        ...prevValues,
                        value: undefined,
                      }));
                    }
                  }}
                />
              )}
            </InputField>
            <InputField<Value, 'value'>
              name={'value'}
              label={'Tag value'}
              labelProps={{ level: 2 }}
            >
              {(inputProps) => (
                <Select
                  {...inputProps}
                  mode={'DYNAMIC'}
                  keepUnusedOptionsAvailable={false}
                  allowClear={true}
                  isCopyable={true}
                  isLoading={isLoading(valueQueryResult.data)}
                  isDisabled={!selectedKey}
                  options={(getOr(valueQueryResult.data, []) as unknown as Array<string>)
                    .filter((value) => value?.length > 0)
                    .map((value) => ({ label: value, value: value }))}
                />
              )}
            </InputField>
            <FormValidationErrors />
            <div className={s.buttons}>
              <Button htmlType="submit" type="PRIMARY" isDisabled={!isFormValid}>
                Confirm
              </Button>
              <Button onClick={handleCancel}>Cancel</Button>
            </div>
          </div>
        );
      }}
    </Form>
  );
}
