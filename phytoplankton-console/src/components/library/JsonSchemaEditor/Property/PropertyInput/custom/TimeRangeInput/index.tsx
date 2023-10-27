import { TimePicker } from 'antd';
import moment from 'moment';
import { UiSchemaTransactionTimeRange } from '@/components/library/JsonSchemaEditor/types';
import { InputProps } from '@/components/library/Form';

interface ValueType {
  startTime?: number;
  endTime?: number;
}

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaTransactionTimeRange;
}

const TimeRangeInput = (props: Props) => {
  const { onChange, value } = props;
  const handleTimeRangeChange = (startTime?: number, endTime?: number) => {
    onChange?.({
      startTime: startTime,
      endTime: endTime,
    });
  };

  return (
    <div>
      <TimePicker.RangePicker
        value={
          value?.startTime && value.endTime
            ? [moment.unix(value?.startTime / 1000), moment.unix(value?.endTime / 1000)]
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
