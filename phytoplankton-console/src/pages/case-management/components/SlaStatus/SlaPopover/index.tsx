import cn from 'clsx';
import SlaPolicyDetails, { SLAPolicyStatusDetails, statusClass } from '../SlaPolicyDetails';
import s from './styles.module.less';
import Popover from '@/components/ui/Popover';
import { useSlaPolicy } from '@/hooks/api';
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
  const policyResult = useSlaPolicy(slaPolicyDetail.slaPolicyId);
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
