import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { Option } from '@/components/library/Select';

export function slaPoliciesOptions(slaPolicies: SLAPolicy[], label: string): Option<string>[] {
  return slaPolicies.map((slaPolicy) => ({
    label: slaPolicy[label],
    value: slaPolicy.id,
  }));
}
