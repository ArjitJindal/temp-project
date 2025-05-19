import { TRANSACTION_TYPES } from '@flagright/lib/utils';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
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

const useUniquesData = (uniqueTypeProps: UniqueTypeProps) => {
  const api = useApi();
  const result = useQuery(
    UNIQUES(uniqueTypeProps.type, uniqueTypeProps.uniqueType),
    () => {
      if (uniqueTypeProps.type === 'transactions') {
        return api.getTransactionsUniques({ field: uniqueTypeProps.uniqueType });
      } else {
        return api.getUsersUniques({ field: uniqueTypeProps.uniqueType });
      }
    },
    { enabled: !!uniqueTypeProps.uniqueType },
  );
  return getOr(result.data, []);
};

const useOptions = (data: string[], uniqueType: TransactionsUniquesField | UsersUniquesField) => {
  return useMemo(
    () =>
      uniq([...(data ?? []), ...(STATIC_VALUES[uniqueType as TransactionsUniquesField] ?? [])]).map(
        (x) => ({
          label: humanizeAuto(x),
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
}) => {
  const data = useUniquesData(props.uniqueTypeProps);
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
}) => {
  const data = useUniquesData(props.uniqueTypeProps);
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
