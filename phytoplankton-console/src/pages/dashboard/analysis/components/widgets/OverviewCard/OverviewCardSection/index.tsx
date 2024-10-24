import cn from 'clsx';
import { Link } from 'react-router-dom';
import s from './styles.module.less';
import Skeleton from '@/components/library/Skeleton';
import { AsyncResource, hasValue } from '@/utils/asyncResource';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';
import Warning from '@/components/ui/icons/Remix/system/error-warning-line.react.svg';
import Tooltip from '@/components/library/Tooltip';

export interface SectionProps {
  title: string;
  value: AsyncResource<string | number>;
  description?: string;
  hyperlink?: string;
  toolTipInfo?: string;
}

export const OverviewCardSection = (props: SectionProps) => {
  const { title, value, description, hyperlink, toolTipInfo } = props;
  return (
    <div className={cn(s.section, !hasValue(value) && s.skeleton)}>
      <div className={s.title}>
        <span>{title}</span>
        {hyperlink && (
          <Link to={hyperlink} target="_blank">
            <LinkIcon className={s.linkIcon} />
          </Link>
        )}
      </div>
      <div className={s.body}>
        <div className={s.value}>
          <Skeleton res={value} length={5}>
            {(v) => v}
          </Skeleton>
        </div>
        {description && <div className={s.description}>{description}</div>}
      </div>
      {toolTipInfo && toolTipInfo.length > 0 && (
        <div className={s.tooltip}>
          <Tooltip title={toolTipInfo}>
            <Warning />
          </Tooltip>
        </div>
      )}
    </div>
  );
};
