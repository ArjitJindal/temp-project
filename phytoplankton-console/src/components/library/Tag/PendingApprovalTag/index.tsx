import Tag from '../index';
import style from './index.module.less';
import HistoryLine from '@/components/ui/icons/Remix/system/history-line.react.svg';

const PendingApprovalTag = () => {
  return (
    <Tag className={style.root} color="action" icon={<HistoryLine className={style.icon} />}>
      <span>Pending approval</span>
    </Tag>
  );
};

export default PendingApprovalTag;
