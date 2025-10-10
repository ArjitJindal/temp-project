import { RangeValue } from 'rc-picker/es/interface';
import { dayCalc, granularityTypeTitles } from '../../../utils/date-utils';
import s from './style.module.less';
import { Dayjs, dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;
export type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY';
export const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' };
export const DEFAULT_DATE_RANGE: RangeValue<Dayjs> = [dayjs().subtract(1, 'year'), dayjs()];

export const calcGranularity = (type: string): GranularityValuesType => {
  if (type === 'YEAR') {
    return granularityValues.MONTH as GranularityValuesType;
  } else if (type === 'MONTH' || type === 'WEEK') {
    return granularityValues.DAY as GranularityValuesType;
  }
  return granularityValues.HOUR as GranularityValuesType;
};

interface Props {
  timeWindowType: timeframe;
  setTimeWindowType: (timeWindowType: timeframe) => void;
  setGranularity: (granularity: GranularityValuesType) => void;
  dateRange: RangeValue<Dayjs>;
  setDateRange: (dateRange: RangeValue<Dayjs>) => void;
}

export default function GranularDatePicker(props: Props) {
  const { setGranularity, dateRange, setDateRange, timeWindowType, setTimeWindowType } = props;
  return (
    <div className={s.salesExtraWrap}>
      <div className={s.salesExtra}>
        {granularityTypeTitles.map(({ type, title }) => (
          <a
            key={type}
            className={type === timeWindowType ? s.currentDate : ''}
            onClick={() => {
              setTimeWindowType(type);
              setDateRange([dayCalc(type), dayjs()]);
              setGranularity(calcGranularity(type));
            }}
          >
            {title}
          </a>
        ))}
      </div>
      <DatePicker.RangePicker
        value={dateRange}
        onChange={(e) => {
          setDateRange(e);
          setTimeWindowType(null);
        }}
      />
    </div>
  );
}
