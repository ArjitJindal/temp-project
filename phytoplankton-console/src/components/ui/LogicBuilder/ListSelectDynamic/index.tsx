import { TRANSACTION_TYPES } from '@flagright/lib/utils';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { uniq } from 'lodash';
import { useMemo } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { TransactionsUniquesField } from '@/apis';
import { getOr } from '@/utils/asyncResource';
import Select from '@/components/library/Select';

const STATIC_VALUES: Partial<Record<TransactionsUniquesField, string[]>> = {
  TRANSACTION_TYPES: TRANSACTION_TYPES as string[],
};

export const SingleListSelectDynamic = (props: {
  value?: string | null;
  uniqueType?: TransactionsUniquesField;
  onChange: (val: string | undefined) => void;
}) => {
  const uniqueType = props.uniqueType as TransactionsUniquesField | undefined;
  const api = useApi();
  const useTransactionsUniquesResult = useQuery(
    TRANSACTIONS_UNIQUES(uniqueType as TransactionsUniquesField),
    () => {
      return api.getTransactionsUniques({ field: uniqueType as TransactionsUniquesField });
    },
    {
      enabled: !!uniqueType,
    },
  );
  const data = getOr(useTransactionsUniquesResult.data, []);

  const options = useMemo(
    () =>
      uniq([...(data ?? []), ...(uniqueType ? STATIC_VALUES[uniqueType] ?? [] : [])]).map((x) => ({
        label: humanizeAuto(x),
        value: x,
      })),
    [data, uniqueType],
  );

  return (
    <Select
      mode="DYNAMIC"
      options={options}
      value={props.value ?? undefined}
      onChange={props.onChange}
    />
  );
};

export const MultiListSelectDynamic = (props: {
  uniqueType: TransactionsUniquesField;
  value?: string[];
  onChange: (val: string[] | undefined) => void;
}) => {
  const api = useApi();
  const useTransactionsUniquesResult = useQuery(TRANSACTIONS_UNIQUES(props.uniqueType), () =>
    api.getTransactionsUniques({ field: props.uniqueType }),
  );
  const data = getOr(useTransactionsUniquesResult.data, []);
  const options = useMemo(
    () =>
      uniq([...(data ?? []), ...(STATIC_VALUES[props.uniqueType] ?? [])]).map((x) => ({
        label: humanizeAuto(x),
        value: x,
      })),
    [data, props.uniqueType],
  );

  return (
    <Select<string>
      mode="TAGS"
      options={options}
      value={props.value ?? undefined}
      onChange={props.onChange}
    />
  );
};
