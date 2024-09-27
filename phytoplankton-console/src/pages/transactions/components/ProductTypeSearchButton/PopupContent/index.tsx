import React, { useState } from 'react';
import { Select } from 'antd';
import { Value } from '../types';
import s from './style.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import Button from '@/components/library/Button';
interface Props {
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
}
export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;

  const api = useApi();
  const result = useQuery(TRANSACTIONS_UNIQUES('PRODUCT_TYPES'), async () => {
    return await api.getTransactionsUniques({
      field: 'PRODUCT_TYPES',
    });
  });
  const [value, setValue] = useState(initialState.productTypes);
  return (
    <div className={s.root}>
      <Select<string[]>
        style={{ width: '100%' }}
        showSearch={true}
        allowClear={true}
        className={s.select}
        loading={isLoading(result.data)}
        options={(getOr(result.data, []) as unknown as Array<string>)
          .filter((key) => key?.length > 0)
          .map((key) => ({ label: key, value: key }))}
        mode="multiple"
        value={value}
        onChange={(value) => {
          setValue(value);
        }}
      />
      <div className={s.footer}>
        <Button
          type="PRIMARY"
          onClick={() => {
            onConfirm({ productTypes: value });
          }}
        >
          Confirm
        </Button>
        <Button onClick={onCancel} type={'SECONDARY'}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
