import cn from 'clsx';
import SlaPolicyDetails, { SLAPolicyStatusDetails, statusClass } from '../SlaPolicyDetails';
import s from './styles.module.less';
import Popover from '@/components/ui/Popover';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SLA_POLICY } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { Case, Alert, Account } from '@/apis';

interface Props {
  slaPolicyDetail: SLAPolicyStatusDetails;
  index: number;
  entity: Case | Alert;
  accounts: Account[];
}

function SlaPopover(props: Props) {
  const { slaPolicyDetail, index, entity, accounts } = props;
  const api = useApi();
  const policyResult = useQuery(SLA_POLICY(slaPolicyDetail.slaPolicyId), async () => {
    return api.getSlaPolicy({ slaId: slaPolicyDetail.slaPolicyId });
  });
  const policy = getOr(policyResult.data, undefined);
  return (
    <Popover
      title={`Policy name: ${policy?.name ?? '-'}`}
      content={
        <SlaPolicyDetails
          slaPolicyDetail={slaPolicyDetail}
          policy={policy}
          entity={entity}
          accounts={accounts}
        />
      }
      trigger="click"
      getPopupContainer={(triggerNode: HTMLElement) => triggerNode.parentElement as HTMLElement}
      key={`SlaPopover-${index}`}
    >
      <div
        key={index}
        className={cn(s.statusDisplay, s[statusClass[slaPolicyDetail.policyStatus]])}
      />
    </Popover>
  );
}
export default SlaPopover;
