import s from './index.module.less';
import { LSEGMediaCheckParameters, TimeWindowGranularity } from '@/apis';
import Checkbox from '@/components/library/Checkbox';
import { P } from '@/components/ui/Typography';
import NumberInput from '@/components/library/NumberInput';
import Select, { Option } from '@/components/library/Select';
import Label from '@/components/library/Label';

interface Props {
  value?: LSEGMediaCheckParameters;
  onChange?: (value?: LSEGMediaCheckParameters) => void;
}

const granularityOptions: Option<TimeWindowGranularity>[] = [
  { value: 'now', label: 'Now' },
  { value: 'all_time', label: 'All time' },
  { value: 'year', label: 'year ago' },
  { value: 'month', label: 'month ago' },
];

export const LSEGMediaCheckInput = (props: Props) => {
  const { value, onChange } = props;
  return (
    <div className={s.root}>
      <div className={s.checkboxContainer}>
        <Checkbox
          value={value?.enabled ?? false}
          onChange={(enabled) => {
            onChange?.({ ...value, enabled: enabled ?? false });
          }}
        />{' '}
        <P variant="m" fontWeight="medium">
          Enable LSEG adverse media screening
        </P>
      </div>
      {value?.enabled && (
        <div className={s.timeWindowContainer}>
          <Label label={'Media published from'} required={{ value: false, showHint: true }}>
            <TimeWindowGranularityInputs value={value} isStart={true} onChange={onChange} />
          </Label>
          <Label label={'Media published to'} required={{ value: false, showHint: true }}>
            <TimeWindowGranularityInputs value={value} isStart={false} onChange={onChange} />
          </Label>
        </div>
      )}
    </div>
  );
};

function TimeWindowGranularityInputs(
  props: Props & {
    isStart: boolean;
  },
) {
  const { value, onChange, isStart } = props;
  const granularity = isStart
    ? value?.timeWindow?.startGranularity
    : value?.timeWindow?.endGranularity;
  return (
    <div className={s.timeWindowGranularityInputs}>
      {granularity && granularity !== 'now' && granularity !== 'all_time' && (
        <NumberInput
          min={0}
          value={isStart ? value?.timeWindow?.startUnits : value?.timeWindow?.endUnits}
          onChange={(newUnits) => {
            const newUnitsValue = Math.round(newUnits ?? 0);
            onChange?.({
              ...value,
              timeWindow: {
                ...value?.timeWindow,
                ...(isStart ? { startUnits: newUnitsValue } : { endUnits: newUnitsValue }),
              },
            });
          }}
        />
      )}
      <Select<TimeWindowGranularity>
        options={granularityOptions.filter((x) =>
          isStart ? x.value !== 'all_time' : x.value !== 'now',
        )}
        value={granularity}
        onChange={(newValue) => {
          const granularityKey = isStart ? 'startUnits' : 'endUnits';
          onChange?.({
            ...value,
            timeWindow: {
              ...value?.timeWindow,
              ...(isStart ? { startGranularity: newValue } : { endGranularity: newValue }),
              ...(newValue === 'now' || newValue === 'all_time'
                ? { [granularityKey]: undefined }
                : {}),
            },
          });
        }}
        mode="SINGLE"
      />
    </div>
  );
}
