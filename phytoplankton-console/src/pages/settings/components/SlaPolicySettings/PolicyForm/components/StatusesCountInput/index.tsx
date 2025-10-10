import React from 'react';
import { findIndex } from 'lodash';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import OperatorSelect from '../OperatorSelect';
import s from './styles.module.less';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import {
  NumberOperators,
  PolicyStatusDetailsStatusesCount,
  PolicyStatusDetailsStatusesEnum,
} from '@/apis';
import { Option } from '@/components/library/Select';

interface Props {
  statuses: Array<PolicyStatusDetailsStatusesEnum>;
  onChange: (value: Array<PolicyStatusDetailsStatusesCount> | undefined) => void;
  currentValues: Array<PolicyStatusDetailsStatusesCount> | undefined;
}

const numberOperatorOptions: Option<NumberOperators>[] = [
  { label: '=', value: 'EQ' },
  { label: '>', value: 'GT' },
  { label: '<', value: 'LT' },
  { label: '>=', value: 'GTE' },
  { label: '<=', value: 'LTE' },
  { label: '!=', value: 'NE' },
];

function getStatusIndex(
  status: PolicyStatusDetailsStatusesEnum,
  currentValues: Array<PolicyStatusDetailsStatusesCount> | undefined,
) {
  return findIndex(currentValues, (o) => o.status === status);
}

function StatusesCountInput(props: Props) {
  const { statuses, onChange, currentValues } = props;
  return (
    <>
      {statuses?.map((status, index) => {
        const currentIndex = getStatusIndex(status, currentValues);
        const { count, operator } = currentValues?.[currentIndex] ?? {};
        return (
          <React.Fragment key={index}>
            <div className={s.indentedLabel}>
              <Label label={`${humanizeSnakeCase(status)} status count`} />
            </div>
            <OperatorSelect<NumberOperators>
              value={operator}
              onChange={(value) => {
                if (value) {
                  if (currentIndex !== -1 && currentValues) {
                    currentValues[currentIndex].operator = value;
                    onChange([...currentValues]);
                  } else {
                    onChange([...(currentValues ?? []), { status, operator: value, count: 0 }]);
                  }
                }
              }}
              options={numberOperatorOptions}
            />
            <NumberInput
              value={count}
              onChange={(value) => {
                if (currentIndex !== -1 && currentValues) {
                  currentValues[currentIndex].count = value ?? 0;
                  onChange([...currentValues]);
                } else {
                  onChange([
                    ...(currentValues ?? []),
                    { status, operator: operator ?? 'EQ', count: value ?? 0 },
                  ]);
                }
              }}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

export default StatusesCountInput;
