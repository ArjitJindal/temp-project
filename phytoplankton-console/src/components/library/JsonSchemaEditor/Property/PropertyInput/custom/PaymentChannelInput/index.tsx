import React from 'react';
import { UiSchemaPaymentChannel } from '../../../../types';
import { useTransactionsUniques } from '@/hooks/api';
import { InputProps } from '@/components/library/Form';
import Select, { Option } from '@/components/library/Select';
import { getOr } from '@/utils/asyncResource';

interface Props extends InputProps<string[]> {
  uiSchema?: UiSchemaPaymentChannel;
}

export default function PaymentChannelInput(props: Props) {
  const { ...rest } = props;
  const uniquesRes = useTransactionsUniques('PAYMENT_CHANNELS');
  const options: Option<string>[] = (getOr(uniquesRes.data, []) as string[])
    .filter(Boolean)
    .map((value) => ({ value, label: value }));

  return (
    <Select options={options} placeholder="Select payment channel" mode="MULTIPLE" {...rest} />
  );
}
