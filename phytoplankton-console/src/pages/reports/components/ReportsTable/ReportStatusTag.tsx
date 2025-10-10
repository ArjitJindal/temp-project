import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import Tag from '@/components/library/Tag';
import { ReportStatus } from '@/apis';

export default function ReportStatusTag(props: { status: ReportStatus; onClick?: () => void }) {
  return (
    <Tag className={cn(s.tag, s[`status-${props.status}`])} onClick={props.onClick}>
      {humanizeConstant(props.status)}
    </Tag>
  );
}
