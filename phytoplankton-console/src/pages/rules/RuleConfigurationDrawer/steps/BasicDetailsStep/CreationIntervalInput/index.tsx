import s from './style.module.less';
import Select from '@/components/library/Select';
import { neverReturn } from '@/utils/lang';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import {
  AlertCreationIntervalInstantly,
  AlertCreationIntervalMonthly,
  AlertCreationIntervalWeekly,
  AlertCreationIntervalWeeklyDayEnum,
} from '@/apis';

export type AlertCreationInterval =
  | AlertCreationIntervalInstantly
  | AlertCreationIntervalMonthly
  | AlertCreationIntervalWeekly;

export type CreationIntervalType = AlertCreationInterval['type'];

interface Props extends InputProps<AlertCreationInterval> {}

export default function CreationIntervalInput(props: Props) {
  const { value, onChange } = props;
  const intervalType: CreationIntervalType = value?.['type'] ?? 'INSTANTLY';

  function handleChangeType(newIntervalType: CreationIntervalType | undefined) {
    let newValue: AlertCreationInterval;
    switch (newIntervalType) {
      case 'INSTANTLY':
        newValue = {
          type: 'INSTANTLY',
        };
        break;
      case 'WEEKLY':
        newValue = {
          type: 'WEEKLY',
          day: 'MONDAY',
        };
        break;
      case 'MONTHLY':
        newValue = {
          type: 'MONTHLY',
          day: 1,
        };
        break;
      default:
        return neverReturn(newIntervalType, null);
    }
    onChange?.(newValue);
  }

  return (
    <div className={s.root}>
      <Select<CreationIntervalType>
        options={[
          { value: 'INSTANTLY', label: 'Instantly' },
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' },
        ]}
        mode="SINGLE"
        value={intervalType}
        onChange={handleChangeType}
      />
      {value?.type === 'MONTHLY' && (
        <>
          <div>On</div>
          <NumberInput
            value={value?.day}
            min={1}
            max={31}
            onChange={(newValue) => {
              if (newValue != null) {
                onChange?.({
                  ...value,
                  day: newValue,
                });
              }
            }}
          />
        </>
      )}
      {value?.type === 'WEEKLY' && (
        <>
          <div>On</div>
          <Select<AlertCreationIntervalWeeklyDayEnum>
            options={[
              { value: 'MONDAY', label: 'Monday' },
              { value: 'TUESDAY', label: 'Tuesday' },
              { value: 'WEDNESDAY', label: 'Wednesday' },
              { value: 'THURSDAY', label: 'Thursday' },
              { value: 'FRIDAY', label: 'Friday' },
              { value: 'SATURDAY', label: 'Saturday' },
              { value: 'SUNDAY', label: 'Sunday' },
            ]}
            mode="SINGLE"
            value={value.day}
            onChange={(day) => {
              if (day != null) {
                onChange?.({ ...value, day });
              }
            }}
          />
        </>
      )}
    </div>
  );
}
