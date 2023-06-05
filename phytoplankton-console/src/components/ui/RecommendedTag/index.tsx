import { Tag, Tooltip } from 'antd';
import style from './index.module.less';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import COLORS from '@/components/ui/colors';

interface Props {
  tooltipTitle: string;
}

export const RecommendedTag: React.FC<Props> = ({ tooltipTitle }) => {
  return (
    <span>
      <Tooltip title={tooltipTitle}>
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
      </Tooltip>
    </span>
  );
};
