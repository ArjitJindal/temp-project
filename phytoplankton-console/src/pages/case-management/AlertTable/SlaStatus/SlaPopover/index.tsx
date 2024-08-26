import { Popover } from 'antd';
import cn from 'clsx';
import SlaPolicyDetails, { SLAPolicyStatusDetails, statusClass } from '../SlaPolicyDetails';
import s from './styles.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SLA_POLICY } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';

interface Props {
  slaPolicyDetail: SLAPolicyStatusDetails;
  index: number;
  popOverVisible: boolean;
  setPopOverVisible: (visible: boolean) => void;
}

function SlaPopover(props: Props) {
  const { slaPolicyDetail, index, popOverVisible, setPopOverVisible } = props;
  const api = useApi();
  const policyResult = useQuery(SLA_POLICY(slaPolicyDetail.slaPolicyId), async () => {
    return api.getSlaPolicy({ slaId: slaPolicyDetail.slaPolicyId });
  });
  const policy = getOr(policyResult.data, undefined);
  return (
    <Popover
      title={`Policy name: ${policy?.name ?? '-'}`}
      content={<SlaPolicyDetails slaPolicyDetail={slaPolicyDetail} policy={policy} />}
      trigger="click"
      onVisibleChange={(visible) => setPopOverVisible(visible)}
      visible={popOverVisible}
    >
      <div
        key={index}
        className={cn(s.statusDisplay, s[statusClass[slaPolicyDetail.policyStatus]])}
      />
    </Popover>
  );
}
export default SlaPopover;
