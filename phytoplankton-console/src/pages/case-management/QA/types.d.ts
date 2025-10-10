import { Priority } from '@/apis';

export interface QAFormValues {
  samplingName: string;
  samplingDescription: string;
  priority: Priority;
  samplingQuantity: number;
  filters?: Record<string, any>;
  numberOfAlertsQaDone?: number;
  numberOfAlerts?: number;
}
