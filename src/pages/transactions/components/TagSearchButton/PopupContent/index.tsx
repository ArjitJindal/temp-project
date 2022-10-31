import { Input, Select, Form as AntForm } from 'antd';
import React, { useState } from 'react';
import s from './style.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading, map } from '@/utils/asyncResource';
import { Value } from '@/pages/transactions/components/TagSearchButton/types';
import * as Form from '@/components/ui/Form';
import Button from '@/components/ui/Button';

interface Props {
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;

  const api = useApi();
  const result = useQuery(TRANSACTIONS_UNIQUES(), async () => {
    return await api.getTransactionsUniques();
  });
  const tagKeys = map(result.data, ({ tagsKey }) => tagsKey);

  const [state, setState] = useState<Value>(initialState);

  return (
    <AntForm
      onFinish={() => {
        onConfirm(state);
      }}
    >
      <div className={s.root}>
        <Form.Layout.Label title="Tag key">
          <Select<string>
            showSearch={true}
            allowClear={true}
            className={s.select}
            loading={isLoading(tagKeys)}
            options={getOr(tagKeys, []).map((key) => ({
              label: key,
              value: key,
            }))}
            value={state.key}
            onChange={(value) => {
              setState((state) => ({ ...state, key: value }));
            }}
          />
        </Form.Layout.Label>
        <Form.Layout.Label title="Tag value">
          <Input
            allowClear={true}
            value={state.value ?? ''}
            onChange={(e) => {
              setState((state) => ({ ...state, value: e.target.value }));
            }}
          />
        </Form.Layout.Label>
        <div className={s.buttons}>
          <Button htmlType="submit" type="primary">
            Confirm
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </AntForm>
  );
}
