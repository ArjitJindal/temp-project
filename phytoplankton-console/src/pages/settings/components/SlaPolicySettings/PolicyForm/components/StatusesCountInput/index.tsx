import React from 'react';
import { findIndex } from 'lodash';
import OperatorSelect from '../OperatorSelect';
import s from './styles.module.less';
import { PolicyAlertStatusDetailsAlertStatusesEnum } from '@/apis/models/PolicyAlertStatusDetails';
import { PolicyAlertStatusDetailsAlertStatusesCount } from '@/apis/models/PolicyAlertStatusDetailsAlertStatusesCount';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import { humanizeSnakeCase } from '@/utils/humanize';
import { NumberOperators } from '@/apis';
import { Option } from '@/components/library/Select';

interface Props {
  alertStatuses: Array<PolicyAlertStatusDetailsAlertStatusesEnum>;
  onChange: (value: Array<PolicyAlertStatusDetailsAlertStatusesCount> | undefined) => void;
  currentValues: Array<PolicyAlertStatusDetailsAlertStatusesCount> | undefined;
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
  status: PolicyAlertStatusDetailsAlertStatusesEnum,
  currentValues: Array<PolicyAlertStatusDetailsAlertStatusesCount> | undefined,
) {
  return findIndex(currentValues, (o) => o.status === status);
}

function StatusesCountInput(props: Props) {
  const { alertStatuses, onChange, currentValues } = props;
  return (
    <>
      {alertStatuses?.map((status, index) => {
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
