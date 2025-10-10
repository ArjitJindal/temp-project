import { TimePicker } from 'antd';
import moment from 'moment';
import { UiSchemaTransactionTimeRange } from '@/components/library/JsonSchemaEditor/types';
import { InputProps } from '@/components/library/Form';

export interface TimeRangeHourAndMinute {
  utcHours: number;
  utcMinutes: number;
}
interface ValueType {
  startTime?: TimeRangeHourAndMinute;
  endTime?: TimeRangeHourAndMinute;
}

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaTransactionTimeRange;
}

const TimeRangeInput = (props: Props) => {
  const { onChange, value } = props;
  const handleTimeRangeChange = (startTime?: number, endTime?: number) => {
    onChange?.({
      startTime: getHoursAndMinutesFromTimestamp(startTime),
      endTime: getHoursAndMinutesFromTimestamp(endTime),
    });
  };
  function getHoursAndMinutesFromTimestamp(timestamp?: number) {
    if (!timestamp) {
      return undefined;
    }
    const date = new Date(timestamp);
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    return {
      utcHours,
      utcMinutes,
    };
  }

  function hoursAndMinutesToTimestamp(time: TimeRangeHourAndMinute): number {
    const totalSeconds = time.utcHours * 3600 + time.utcMinutes * 60;
    const timestampMilliseconds = totalSeconds * 1000;
    const timestamp = new Date(timestampMilliseconds).getTime() / 1000;
    return Math.floor(timestamp);
  }

  return (
    <div>
      <TimePicker.RangePicker
        value={
          value?.startTime && value.endTime
            ? [
                moment.unix(hoursAndMinutesToTimestamp(value?.startTime)),
                moment.unix(hoursAndMinutesToTimestamp(value?.endTime)),
              ]
            : null
        }
        format={'HH:mm'}
        onChange={(timeRange) => {
          const startTime = timeRange ? timeRange[0]?.valueOf() : undefined;
          const endTime = timeRange ? timeRange[1]?.valueOf() : undefined;
          handleTimeRangeChange(startTime, endTime);
        }}
      />
    </div>
  );
};

export default TimeRangeInput;
