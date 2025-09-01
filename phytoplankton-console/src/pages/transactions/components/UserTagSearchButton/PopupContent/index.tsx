import React, { useCallback, useState } from 'react';
import s from './style.module.less';
import Select from '@/components/library/Select';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import { Value } from '@/pages/transactions/components/TagSearchButton/types';
import Button from '@/components/library/Button';
import InputField from '@/components/library/Form/InputField';
import Form from '@/components/library/Form';

interface Props {
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;
  const [selectedKey, setSelectedKey] = useState<string | undefined>(initialState.key);

  const api = useApi();

  const result = useQuery(USERS_UNIQUES('TAGS_KEY'), async () => {
    return await api.getUsersUniques({
      field: 'TAGS_KEY',
    });
  });
  const tagsValueResult = useQuery(
    USERS_UNIQUES('TAGS_VALUE', { filter: selectedKey }),
    async () => {
      if (!selectedKey) {
        return [];
      }
      return await api.getUsersUniques({
        field: 'TAGS_VALUE',
        filter: selectedKey,
      });
    },
    {
      enabled: !!selectedKey,
    },
  );
  const handleKeyChange = useCallback((key: string | undefined) => {
    setSelectedKey(key);
  }, []);
  return (
    <Form
      onSubmit={(values) => {
        onConfirm(values);
      }}
      initialValues={initialState}
    >
      {({ valuesState }) => {
        const [, setValues] = valuesState;

        return (
          <div className={s.root}>
            <InputField<Value, 'key'> label="Tag key" name={'key'} labelProps={{ level: 2 }}>
              {(inputProps) => (
                <Select<string>
                  allowClear
                  value={inputProps.value}
                  isLoading={isLoading(result.data)}
                  options={(getOr(result.data, []) as unknown as Array<string>)
                    .filter((key) => key?.length > 0)
                    .map((key) => ({ label: key, value: key }))}
                  onChange={(value) => {
                    handleKeyChange(value);
                    if (inputProps.onChange) {
                      inputProps.onChange(value);
                    }
                    setValues((prev) => ({ ...prev, value: undefined }));
                  }}
                />
              )}
            </InputField>
            <InputField<Value, 'value'> label="Tag value" name={'value'} labelProps={{ level: 2 }}>
              {(inputProps) => (
                <Select<string>
                  allowClear
                  isLoading={isLoading(tagsValueResult.data)}
                  isDisabled={!selectedKey}
                  options={(getOr(tagsValueResult.data, []) as unknown as Array<string>)
                    .filter((value) => value?.length > 0)
                    .map((value) => ({ label: value, value: value }))}
                  {...inputProps}
                />
              )}
            </InputField>
            <div className={s.buttons}>
              <Button htmlType="submit" type="PRIMARY">
                Confirm
              </Button>
              <Button onClick={onCancel}>Cancel</Button>
            </div>
          </div>
        );
      }}
    </Form>
  );
}
