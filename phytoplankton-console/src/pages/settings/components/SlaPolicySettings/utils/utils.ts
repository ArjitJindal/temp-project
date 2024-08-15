import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { SLAPolicyConfiguration } from '@/apis/models/SLAPolicyConfiguration';

export interface FormValues {
  id: string;
  name: string;
  description: string;
  policyConfiguration: SLAPolicyConfiguration;
}

export function slaPolicyToFormValues(slaPolicy: SLAPolicy): FormValues {
  return {
    id: slaPolicy.id,
    name: slaPolicy.name,
    description: slaPolicy.description,
    policyConfiguration: slaPolicy.policyConfiguration,
  };
}

export function formValuesToSlaPolicy(values: FormValues, createdBy: string): SLAPolicy {
  return {
    id: values.id,
    name: values.name,
    description: values.description,
    policyConfiguration: values.policyConfiguration,
    createdBy: createdBy,
  };
}
