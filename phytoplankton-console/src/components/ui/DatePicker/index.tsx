/**
 * Fix Refrenced from https://4x.ant.design/docs/react/replace-moment#DatePicker.tsx as DatePicker uses Moment
 */
import type { GenerateConfig } from 'rc-picker/lib/generate/index';

import dayjsGenerateConfig from 'rc-picker/lib/generate/dayjs';
import generatePicker from 'antd/es/date-picker/generatePicker';
import { Dayjs } from '@/utils/dayjs';

const config: GenerateConfig<Dayjs> = dayjsGenerateConfig as unknown as GenerateConfig<Dayjs>;

const DatePicker = generatePicker<Dayjs>(config);

export default DatePicker;
