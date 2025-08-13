import Tag from '../index';
import style from './index.module.less';
import FlowChart from '@/components/ui/icons/Remix/editor/flow-chart.react.svg';
import Tooltip from '@/components/library/Tooltip';

const DynamicRuleTag: React.FC = () => {
  return (
    <Tag className={style.root} icon={<FlowChart className={style.icon} />}>
      <Tooltip title="Dynamic rules automatically find suspicious activity without static configurations">
        <span>Dynamic rules</span>
      </Tooltip>
    </Tag>
  );
};

export default DynamicRuleTag;
