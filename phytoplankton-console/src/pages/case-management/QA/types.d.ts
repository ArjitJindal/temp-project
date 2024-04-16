import { Priority } from '@/apis';

export interface QAFormValues {
  samplingName: string;
  samplingDescription: string;
  priority: Priority;
  samplingPercentage: number;
}
