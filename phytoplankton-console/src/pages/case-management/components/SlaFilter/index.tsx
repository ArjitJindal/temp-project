import React, { useRef } from 'react';
import PopupContent from './PopupContent';
import { SLAPolicyStatus } from '@/apis';
import { slaPoliciesOptions, useSlas } from '@/utils/sla';
import { Option } from '@/components/library/Select';
import QuickFilter from '@/components/library/QuickFilter';
import { FormRef } from '@/components/library/Form';
import { getOr } from '@/utils/asyncResource';

interface Props {
  slaPolicyId?: string;
  slaPolicyStatus?: SLAPolicyStatus;
  onConfirm: (slaPolicyId?: string, policyStatus?: SLAPolicyStatus) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

const policyStatusOptions: Option<SLAPolicyStatus>[] = [
  {
    label: 'OK',
    value: 'OK',
  },
  {
    label: 'Warning',
    value: 'WARNING',
  },
  {
    label: 'Breached',
    value: 'BREACHED',
  },
];

function SlaFilter(props: Props) {
  const slaPoliciesData = useSlas();
  const { slaPolicyId, slaPolicyStatus } = props;
  const formRef = useRef<FormRef<any>>(null);
  const isEmpty = !slaPolicyId && !slaPolicyStatus;
  return (
    <QuickFilter
      title="SLA status"
      buttonText={isEmpty ? undefined : slaPolicyId ? slaPolicyId : slaPolicyStatus ?? 'All'}
      onClear={
        isEmpty
          ? undefined
          : () => {
              props.onConfirm(undefined, undefined);
              formRef.current?.setValues({});
            }
      }
      onUpdateFilterClose={props.onUpdateFilterClose}
    >
      {({ setOpen }) => (
        <PopupContent
          slaPolicyOptions={slaPoliciesOptions(getOr(slaPoliciesData, []), 'name')}
          policyStatusOptions={policyStatusOptions}
          handleClose={() => setOpen(false)}
          onConfirm={props.onConfirm}
          formRef={formRef}
          slaPolicyId={slaPolicyId}
          slaPolicyStatus={slaPolicyStatus}
        />
      )}
    </QuickFilter>
  );
}

export default SlaFilter;
