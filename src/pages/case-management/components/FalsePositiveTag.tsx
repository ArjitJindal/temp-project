import { Tag, Tooltip } from 'antd';
import style from './index.module.less';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';

import COLORS from '@/components/ui/colors';

interface Props {
  confidence: number;
}

export const FalsePositiveTag: React.FC<Props> = ({ confidence }) => {
  return (
    <span className={style.falsePositiveTag}>
      <Tooltip title={'Accuracy increases as you close more cases.'}>
        <Tag
          color={COLORS.navyBlue.base}
          icon={
            <span className={style.icon}>
              <BrainIcon />
            </span>
          }
        >
          {confidence}% False Positive
        </Tag>
      </Tooltip>
    </span>
  );
};
