import { TRANSACTION_TYPES } from '@flagright/lib/utils';
import { uniq } from 'lodash';
import { useMemo } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { UNIQUES } from '@/utils/queries/keys';
import { TransactionsUniquesField, UsersUniquesField } from '@/apis';
import { getOr } from '@/utils/asyncResource';
import Select from '@/components/library/Select';

const STATIC_VALUES: Partial<Record<TransactionsUniquesField, string[]>> = {
  TRANSACTION_TYPES: TRANSACTION_TYPES as string[],
};

type UniqueTypeProps =
  | { type: 'transactions'; uniqueType: TransactionsUniquesField }
  | { type: 'users'; uniqueType: UsersUniquesField };

const useUniquesData = (uniqueTypeProps: UniqueTypeProps, filterKey?: string) => {
  const api = useApi();

  // For TAGS_VALUE fields, don't fetch data if no filter is provided
  const shouldFetch = uniqueTypeProps.uniqueType !== 'TAGS_VALUE' || !!filterKey;

  const result = useQuery(
    UNIQUES(uniqueTypeProps.type, uniqueTypeProps.uniqueType, { filter: filterKey }),
    () => {
      if (uniqueTypeProps.type === 'transactions') {
        return api.getTransactionsUniques({
          field: uniqueTypeProps.uniqueType,
          filter: filterKey,
        });
      } else {
        return api.getUsersUniques({
          field: uniqueTypeProps.uniqueType,
          filter: filterKey,
        });
      }
    },
    { enabled: !!uniqueTypeProps.uniqueType && shouldFetch },
  );
  return getOr(result.data, []);
};

const useOptions = (data: string[], uniqueType: TransactionsUniquesField | UsersUniquesField) => {
  return useMemo(
    () =>
      uniq([...(data ?? []), ...(STATIC_VALUES[uniqueType as TransactionsUniquesField] ?? [])]).map(
        (x) => ({
          label: x,
          value: x,
        }),
      ),
    [data, uniqueType],
  );
};

export const SingleListSelectDynamic = (props: {
  value?: string | null;
  uniqueTypeProps: UniqueTypeProps;
  onChange: (val: string | undefined) => void;
  filter?: string;
}) => {
  const data = useUniquesData(props.uniqueTypeProps, props.filter);
  const options = useOptions(data, props.uniqueTypeProps.uniqueType);

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
  uniqueTypeProps: UniqueTypeProps;
  value?: string[];
  onChange: (val: string[] | undefined) => void;
  filter?: string;
}) => {
  const data = useUniquesData(props.uniqueTypeProps, props.filter);
  const options = useOptions(data, props.uniqueTypeProps.uniqueType);

  return (
    <Select<string>
      mode="TAGS"
      options={options}
      value={props.value ?? undefined}
      onChange={props.onChange}
    />
  );
};
