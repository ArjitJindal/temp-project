import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { SLAPolicyConfiguration } from '@/apis/models/SLAPolicyConfiguration';
import { SLAPolicyType } from '@/apis/models/SLAPolicyType';

export interface FormValues {
  id: string;
  name: string;
  type: SLAPolicyType;
  description: string;
  policyConfiguration: SLAPolicyConfiguration;
}

export function slaPolicyToFormValues(slaPolicy: SLAPolicy): FormValues {
  return {
    id: slaPolicy.id,
    name: slaPolicy.name,
    type: slaPolicy.type,
    description: slaPolicy.description,
    policyConfiguration: slaPolicy.policyConfiguration,
  };
}

export function formValuesToSlaPolicy(values: FormValues, createdBy: string): SLAPolicy {
  return {
    id: values.id,
    name: values.name,
    type: values.type,
    description: values.description,
    policyConfiguration: values.policyConfiguration,
    createdBy: createdBy,
  };
}
