import { Tooltip } from 'antd';
import { useState } from 'react';
import CasesStatusChangeModal from '../../components/CasesStatusChangeButton/CasesStatusChangeModal';
import s from './index.module.less';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import { CaseStatus } from '@/apis';
import Tag from '@/components/library/Tag';

interface Props {
  confidence: number;
  caseIds: string[];
  newCaseStatus: CaseStatus;
  onSaved: () => void;
  isBlue?: boolean;
  rounded?: boolean;
}

export const FalsePositiveTag: React.FC<Props> = (props: Props) => {
  const { caseIds, onSaved, newCaseStatus, confidence } = props;
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
      <CasesStatusChangeModal
        entityIds={caseIds}
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
