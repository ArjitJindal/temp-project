/**
 * Fix Refrenced from https://4x.ant.design/docs/react/replace-moment#DatePicker.tsx as DatePicker uses Moment
 */

import dayjsGenerateConfig from 'rc-picker/lib/generate/dayjs';
import generatePicker from 'antd/es/date-picker/generatePicker';
import { Dayjs } from '@/utils/dayjs';

const DatePicker = generatePicker<Dayjs>(dayjsGenerateConfig);

export default DatePicker;
