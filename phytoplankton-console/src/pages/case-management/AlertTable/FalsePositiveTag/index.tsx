import { Tooltip } from 'antd';
import { useState } from 'react';
import AlertStatusChangeModal from '../../components/AlertsStatusChangeButton/AlertsStatusChangeModal';
import s from './index.module.less';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import { CaseStatus } from '@/apis';
import Tag from '@/components/library/Tag';
interface Props {
  confidence: number;
  caseIds: string[];
  alertId?: string;
  newCaseStatus: CaseStatus;
  onSaved: () => void;
  isBlue?: boolean;
  rounded?: boolean;
}

export const FalsePositiveTag: React.FC<Props> = (props: Props) => {
  const { alertId, caseIds, onSaved, newCaseStatus, confidence } = props;
  const [isModalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Tooltip title={'Accuracy increases as you close more cases.'}>
        <Tag
          className={s.tag}
          onClick={() => {
            setModalVisible(true);
          }}
          icon={<BrainIcon />}
        >
          {confidence}% False positive
        </Tag>
      </Tooltip>
      <AlertStatusChangeModal
        entityIds={[alertId ?? '']}
        caseId={caseIds[0]}
        isVisible={isModalVisible}
        newStatus={newCaseStatus}
        defaultReasons={newCaseStatus === 'CLOSED' ? ['False positive'] : []}
        onSaved={onSaved}
        onClose={() => {
          setModalVisible(false);
        }}
      />
    </>
  );
};
