import React, { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'ahooks';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { Value } from '../types';
import s from './style.module.less';
import { getOr, isLoading, isSuccess } from '@/utils/asyncResource';
import Select from '@/components/library/Select';
import { useTransactionsUniques } from '@/hooks/api/transactions';
import { TransactionsUniquesField } from '@/apis';

interface Props {
  initialState: Value;
  uniqueType: TransactionsUniquesField;
  onConfirm: (newState: Value) => void;
  defaults?: string[];
  onCancel: () => void;
}

export default function PopupContent(props: Props) {
  const { initialState, uniqueType, onConfirm, defaults, onCancel } = props;
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });

  const keysRes = useTransactionsUniques('TAGS_KEY', undefined, {
    enabled: uniqueType === 'TAGS_VALUE',
  });
  const valuesRes = useTransactionsUniques(
    uniqueType === 'TAGS_VALUE' ? 'TAGS_VALUE' : (uniqueType as TransactionsUniquesField),
    { filter: uniqueType === 'TAGS_VALUE' ? debouncedSearchTerm : undefined },
    {
      enabled: uniqueType !== 'TAGS_VALUE' || !!debouncedSearchTerm,
    },
  );

  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [selectedValues, setSelectedValues] = useState<string[] | undefined>(
    initialState.uniques ?? defaults,
  );

  useEffect(() => {
    if (isSuccess(valuesRes.data) && !selectedValues?.length && defaults?.length) {
      setSelectedValues(defaults);
    }
  }, [valuesRes.data, defaults, selectedValues]);

  const keyOptions = useMemo(() => {
    const data = getOr<string[]>(keysRes.data, []);
    return data.map((v) => ({ label: humanizeAuto(v), value: v }));
  }, [keysRes.data]);

  const valueOptions = useMemo(() => {
    const data = getOr<string[]>(valuesRes.data, []);
    const merged = Array.from(
      new Set([...(data ?? []), ...((defaults as string[] | undefined) ?? [])]),
    );
    return merged.map((v) => ({ label: humanizeAuto(v), value: v }));
  }, [valuesRes.data, defaults]);

  return (
    <div className={s.root}>
      {uniqueType === 'TAGS_VALUE' && (
        <div className={s.contentItem}>
          <div className={s.label}>Tag key</div>
          <Select<string>
            mode="SINGLE"
            placeholder="Select tag key"
            options={keyOptions}
            value={selectedKey}
            onChange={(val) => setSelectedKey(val ?? undefined)}
          />
        </div>
      )}
      <div className={s.contentItem}>
        <div className={s.label}>Value</div>
        <Select<string>
          mode="MULTIPLE_DYNAMIC"
          placeholder="Search value"
          options={valueOptions}
          value={selectedValues}
          onChange={(vals) => setSelectedValues(vals ?? undefined)}
          onSearch={setSearchTerm}
          isLoading={isLoading(valuesRes.data)}
        />
      </div>
      <div className={s.actions}>
        <button className={s.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          className={s.confirm}
          onClick={() => onConfirm({ uniques: selectedValues })}
          disabled={!selectedValues || selectedValues.length === 0}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
