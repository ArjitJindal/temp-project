import { useState } from 'react';
import { uniq } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { Value } from '../types';
import s from './style.module.less';
import { useTransactionsUniques } from '@/hooks/api';
import { getOr, isLoading } from '@/utils/asyncResource';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import { TransactionsUniquesField } from '@/apis';

interface Props {
  initialState: Value;
  onCancel: () => void;
  onConfirm: (value: Value) => void;
  uniqueType: TransactionsUniquesField;
  defaults?: string[];
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm, uniqueType, defaults = [] } = props;

  const result = useTransactionsUniques(uniqueType);

  const [value, setValue] = useState(initialState.uniques);

  return (
    <div className={s.root}>
      <Select
        allowClear={true}
        isLoading={isLoading(result.data)}
        options={uniq(getOr(result.data, []).concat(defaults))
          .filter((key) => key?.length > 0)
          .map((key) => ({ label: humanizeAuto(key), value: key }))}
        mode="MULTIPLE"
        allowNewOptions
        value={value}
        onChange={(value) => {
          setValue(value);
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
