import { Tag, Tooltip } from 'antd';
import { useState } from 'react';
import style from './index.module.less';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import COLORS from '@/components/ui/colors';
import { CaseStatus } from '@/apis';
import CasesStatusChangeModal from '@/pages/case-management/components/CasesStatusChangeButton/CasesStatusChangeModal';

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
      <div className={style.falsePositiveTag}>
        <Tooltip title={'Accuracy increases as you close more cases.'}>
          <Tag
            color={COLORS.navyBlue.base}
            onClick={() => {
              setModalVisible(true);
            }}
            icon={
              <div className={style.tagIcon}>
                <BrainIcon />
              </div>
            }
            className={style.tagOnHover}
          >
            {confidence}% False positive
          </Tag>
        </Tooltip>
      </div>
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
