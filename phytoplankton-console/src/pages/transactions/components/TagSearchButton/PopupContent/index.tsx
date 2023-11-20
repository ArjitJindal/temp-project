import { Select } from 'antd';
import React from 'react';
import s from './style.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import { Value } from '@/pages/transactions/components/TagSearchButton/types';
import Form from '@/components/library/Form';
import Button from '@/components/library/Button';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';

interface Props {
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;

  const api = useApi();
  const result = useQuery(TRANSACTIONS_UNIQUES('TAGS_KEY'), async () => {
    return await api.getTransactionsUniques({
      field: 'TAGS_KEY',
    });
  });

  return (
    <Form<Value>
      initialValues={initialState}
      onSubmit={(values) => {
        onConfirm(values);
      }}
    >
      <div className={s.root}>
        <InputField<Value, 'key'> name={'key'} label={'Tag key'} labelProps={{ level: 2 }}>
          {(inputProps) => (
            <Select<string>
              style={{ width: '100%' }}
              showSearch={true}
              allowClear={true}
              className={s.select}
              loading={isLoading(result.data)}
              options={(getOr(result.data, []) as unknown as Array<string>)
                .filter((key) => key?.length > 0)
                .map((key) => ({ label: key, value: key }))}
              {...inputProps}
            />
          )}
        </InputField>
        <InputField<Value, 'value'> name={'value'} label={'Tag value'} labelProps={{ level: 2 }}>
          {(inputProps) => <TextInput allowClear={true} {...inputProps} />}
        </InputField>
        <div className={s.buttons}>
          <Button htmlType="submit" type="PRIMARY">
            Confirm
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Form>
  );
}
