import { useQuery } from './queries/hooks';
import { SLA_POLICY_LIST } from './queries/keys';
import { AsyncResource, map } from './asyncResource';
import { useApi } from '@/api';
import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { SLAPoliciesResponse } from '@/apis';
import { Option } from '@/components/library/Select';

export function useSlas(): AsyncResource<SLAPolicy[]> {
  const api = useApi();
  const slaPoliciesResult = useQuery<SLAPoliciesResponse>(SLA_POLICY_LIST(), async () => {
    return api.getSlaPolicies();
  });
  return map(slaPoliciesResult.data, ({ items }) => items);
}

export function slaPoliciesOptions(slaPolicies: SLAPolicy[], label: string): Option<string>[] {
  return slaPolicies.map((slaPolicy) => ({
    label: slaPolicy[label],
    value: slaPolicy.id,
  }));
}
