import s from './style.module.less';
import Select from '@/components/library/Select';
import { neverReturn } from '@/utils/lang';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import {
  AlertCreationIntervalDaily,
  AlertCreationIntervalInstantly,
  AlertCreationIntervalMonthly,
  AlertCreationIntervalWeekly,
  AlertCreationIntervalWeeklyDayEnum,
  DailyTime,
} from '@/apis';
import { DAILY_TIMES } from '@/apis/models-custom/DailyTime';

export type AlertCreationInterval =
  | AlertCreationIntervalInstantly
  | AlertCreationIntervalMonthly
  | AlertCreationIntervalWeekly
  | AlertCreationIntervalDaily;

export type CreationIntervalType = AlertCreationInterval['type'];

interface Props extends InputProps<AlertCreationInterval> {}

export default function CreationIntervalInput(props: Props) {
  const { value, onChange } = props;
  const intervalType: CreationIntervalType = value?.['type'] ?? 'INSTANTLY';

  function handleChangeType(newIntervalType: CreationIntervalType | undefined) {
    let newValue: AlertCreationInterval;
    if (newIntervalType == null) {
      return null;
    }
    switch (newIntervalType) {
      case 'INSTANTLY':
        newValue = {
          type: 'INSTANTLY',
        };
        break;
      case 'DAILY':
        newValue = {
          type: 'DAILY',
          time: '0',
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
          { value: 'DAILY', label: 'Daily' },
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' },
        ]}
        mode="SINGLE"
        size="LARGE"
        value={intervalType}
        onChange={handleChangeType}
        style={{ width: 150 }}
      />
      {value?.type === 'DAILY' && (
        <>
          <div>At</div>
          <Select<DailyTime>
            options={DAILY_TIMES.map((time) => ({
              value: time,
              label: `${time.padStart(2, '0')}:00`,
            }))}
            mode="SINGLE"
            size="LARGE"
            value={value.time}
            onChange={(time) => {
              if (time != null) {
                onChange?.({ ...value, time });
              }
            }}
            style={{ width: 80 }}
          />
        </>
      )}
      {value?.type === 'MONTHLY' && (
        <>
          <div>On</div>
          <NumberInput
            value={value?.day}
            min={1}
            max={31}
            size="X2"
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
            size="LARGE"
            value={value.day}
            onChange={(day) => {
              if (day != null) {
                onChange?.({ ...value, day });
              }
            }}
            style={{ width: 150 }}
          />
        </>
      )}
    </div>
  );
}
