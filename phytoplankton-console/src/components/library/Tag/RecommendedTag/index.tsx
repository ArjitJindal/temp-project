import Tag from '../index';
import style from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';

interface Props {
  tooltipTitle: string;
}

const RecommendedTag: React.FC<Props> = ({ tooltipTitle }) => {
  return (
    <Tag className={style.root} icon={<CheckMark className={style.icon} />}>
      <Tooltip title={tooltipTitle}>
        <span>Recommended</span>
      </Tooltip>
    </Tag>
  );
};

export default RecommendedTag;
