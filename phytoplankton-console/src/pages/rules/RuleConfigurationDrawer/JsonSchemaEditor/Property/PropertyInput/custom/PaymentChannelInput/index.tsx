import React from 'react';
import { UiSchemaPaymentChannel } from '../../../../types';
import { useQuery } from '@/utils/queries/hooks';
import { InputProps } from '@/components/library/Form';
import Select, { Option } from '@/components/library/Select';
import { useApi } from '@/api';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';

interface Props extends InputProps<string[]> {
  uiSchema?: UiSchemaPaymentChannel;
}

export default function PaymentChannelInput(props: Props) {
  const { ...rest } = props;
  const api = useApi();

  const result: QueryResult<Option<string>[]> = useQuery(
    TRANSACTIONS_UNIQUES('PAYMENT_CHANNELS'),
    async () => {
      const uniques = await api.getTransactionsUniques({
        field: 'PAYMENT_CHANNELS',
      });

      return uniques.map((value) => {
        if (value) {
          return { value: value, label: value };
        }
      });
    },
  );

  return (
    <Select
      options={getOr(result.data, [])}
      placeholder="Select payment channel"
      mode="MULTIPLE"
      {...rest}
    />
  );
}
