import { Tooltip } from 'antd';
import Tag from '../index';
import style from './index.module.less';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';

interface Props {
  tooltipTitle: string;
}

const RecommendedTag: React.FC<Props> = ({ tooltipTitle }) => {
  return (
    <Tooltip title={tooltipTitle}>
      <Tag className={style.root} icon={<CheckMark className={style.icon} />}>
        Recommended
      </Tag>
    </Tooltip>
  );
};

export default RecommendedTag;
