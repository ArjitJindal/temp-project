import cn from 'clsx';
import s from './styles.module.less';
import Skeleton from '@/components/library/Skeleton';
import { AsyncResource, hasValue } from '@/utils/asyncResource';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';
import Warning from '@/components/ui/icons/Remix/system/error-warning-line.react.svg';
import Tooltip from '@/components/library/Tooltip';
import { formatNumber, isValidNumber } from '@/utils/number';
import Link from '@/components/ui/Link';

interface BaseProps {
  title: string | React.ReactNode;
  description?: string;
  hyperlink?: string;
  toolTipInfo?: string;
}

interface ValueSectionProps extends BaseProps {
  type?: 'SIMPLE';
  value: AsyncResource<string | number>;
  valueComponent?: never;
}

interface CustomRenderProps extends BaseProps {
  type: 'DISPLAY';
  valueComponent: React.ReactNode;
}

export type SectionProps = ValueSectionProps | CustomRenderProps;

export const OverviewCardSection = (props: SectionProps) => {
  const { title, description, hyperlink, toolTipInfo, type } = props;
  return (
    <div className={cn(s.section, type !== 'DISPLAY' && !hasValue(props.value) && s.skeleton)}>
      <div className={s.title}>
        {typeof title === 'string' ? <span>{title}</span> : title}
        {hyperlink && (
          <Link to={hyperlink} target="_blank">
            <LinkIcon className={s.linkIcon} />
          </Link>
        )}
      </div>
      <div className={s.body}>
        <div className={s.value}>
          {type === 'DISPLAY' ? (
            props.valueComponent
          ) : (
            <Skeleton res={props.value} length={5}>
              {(v) =>
                typeof v === 'string'
                  ? isValidNumber(v)
                    ? formatNumber(v)
                    : v
                  : formatNumber(v as number)
              }
            </Skeleton>
          )}
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
