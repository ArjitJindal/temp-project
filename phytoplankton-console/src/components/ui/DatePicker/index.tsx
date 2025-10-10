/**
 * Fix Refrenced from https://4x.ant.design/docs/react/replace-moment#DatePicker.tsx as DatePicker uses Moment
 */
import type { GenerateConfig } from 'rc-picker/lib/generate/index';

import dayjsGenerateConfig from 'rc-picker/lib/generate/dayjs';
import generatePicker, {
  PickerDateProps,
  PickerTimeProps,
  RangePickerProps,
} from 'antd/es/date-picker/generatePicker';
import { PickerComponentClass } from 'antd/lib/date-picker/generatePicker/interface';
import { Dayjs } from '@/utils/dayjs';
import { usePortalContainer } from '@/components/ui/PortalContainerProvider';

const config: GenerateConfig<Dayjs> = dayjsGenerateConfig as unknown as GenerateConfig<Dayjs>;
const AntDatePicker = generatePicker<Dayjs>(config);

const _DatePicker = wrapAntComponentWithPopoverContext(AntDatePicker);

const result = _DatePicker as typeof _DatePicker & {
  WeekPicker: React.FC<PickerDateProps<Dayjs>>;
  MonthPicker: React.FC<PickerDateProps<Dayjs>>;
  YearPicker: React.FC<PickerDateProps<Dayjs>>;
  RangePicker: React.FC<RangePickerProps<Dayjs>>;
  TimePicker: React.FC<PickerTimeProps<Dayjs>>;
  QuarterPicker: React.FC<PickerTimeProps<Dayjs>>;
};

result.WeekPicker = wrapAntComponentWithPopoverContext(AntDatePicker.WeekPicker);
result.MonthPicker = wrapAntComponentWithPopoverContext(AntDatePicker.MonthPicker);
result.YearPicker = wrapAntComponentWithPopoverContext(AntDatePicker.YearPicker);
result.RangePicker = wrapAntComponentWithPopoverContext(AntDatePicker.RangePicker);
result.TimePicker = wrapAntComponentWithPopoverContext(AntDatePicker.TimePicker);
result.QuarterPicker = wrapAntComponentWithPopoverContext(AntDatePicker.QuarterPicker);

export default result;

/*
  Helpers
 */

function wrapAntComponentWithPopoverContext<
  Props extends {
    getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  },
>(Component: PickerComponentClass<Props, unknown>): React.FC<Props> {
  const WrappedComponent: React.FC<Props> = (props) => {
    const { getPopupContainer } = props;
    const portalContainer = usePortalContainer();
    return (
      <Component {...props} getPopupContainer={getPopupContainer || portalContainer.getElement} />
    );
  };
  WrappedComponent.displayName = Component.displayName || Component.name;
  return WrappedComponent;
}
