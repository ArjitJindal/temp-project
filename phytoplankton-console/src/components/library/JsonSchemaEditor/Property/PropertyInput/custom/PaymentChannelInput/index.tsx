import { UiSchemaPaymentChannel } from '../../../../types';
import { InputProps } from '@/components/library/Form';
import Select, { Option } from '@/components/library/Select';
import { getOr } from '@/utils/asyncResource';
import { useTransactionsUniques } from '@/utils/api/transactions';
import { QueryResult } from '@/utils/queries/types';

interface Props extends InputProps<string[]> {
  uiSchema?: UiSchemaPaymentChannel;
}

export default function PaymentChannelInput(props: Props) {
  const { ...rest } = props;
  const result = useTransactionsUniques({
    field: 'PAYMENT_CHANNELS',
    optionise: true,
  }) as QueryResult<Option<string>[]>;
  return (
    <Select
      options={getOr(result.data, [])}
      placeholder="Select payment channel"
      mode="MULTIPLE"
      {...rest}
    />
  );
}
