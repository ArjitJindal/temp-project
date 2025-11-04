import { useState } from 'react';
import { uniq } from 'lodash';
import { Value } from '../types';
import s from './style.module.less';
import { getOr, isLoading } from '@/utils/asyncResource';
import Button from '@/components/library/Button';
import Select, { Option } from '@/components/library/Select';
import { TransactionsUniquesField } from '@/apis';
import { useTransactionsUniques } from '@/utils/api/transactions';
import { QueryResult } from '@/utils/queries/types';

interface Props {
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
  uniqueType: TransactionsUniquesField;
  defaults?: string[];
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm, uniqueType, defaults = [] } = props;

  const result = useTransactionsUniques({ field: uniqueType, optionise: true }) as QueryResult<
    Option<string>[]
  >;

  const [value, setValue] = useState(initialState.uniques);

  return (
    <div className={s.root}>
      <Select
        allowClear={true}
        isLoading={isLoading(result.data)}
        options={uniq(
          getOr(result.data, []).concat(defaults.map((value) => ({ value, label: value }))),
        )}
        mode="MULTIPLE_DYNAMIC"
        value={value}
        onChange={(newValue) => {
          setValue(newValue ?? []);
        }}
      />
      <div className={s.footer}>
        <Button
          type="PRIMARY"
          onClick={() => {
            onConfirm({ uniques: value });
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
