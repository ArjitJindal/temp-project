import { Tag } from 'antd';
import style from './index.module.less';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import COLORS from '@/components/ui/colors';

export const RecommendedTag: React.FC = () => {
  return (
    <span>
      <span className={style.tag}>
        <Tag
          color={COLORS.brandBlue.tint}
          icon={
            <span className={style.icon}>
              <CheckMark />
            </span>
          }
        >
          Recommended
        </Tag>
      </span>
    </span>
  );
};
