import cn from 'clsx';
import s from './styles.module.less';
import Skeleton from '@/components/library/Skeleton';
import { AsyncResource, hasValue } from '@/utils/asyncResource';

export interface SectionProps {
  title: string;
  value: AsyncResource<string | number>;
  description?: string;
}

export const OverviewCardSection = (props: SectionProps) => {
  const { title, value, description } = props;
  return (
    <div className={cn(s.section, !hasValue(value) && s.skeleton)}>
      <div className={s.title}>{title}</div>
      <div className={s.body}>
        <div className={s.value}>
          <Skeleton res={value} length={5}>
            {(v) => v}
          </Skeleton>
        </div>
        {description && <div className={s.description}>{description}</div>}
      </div>
    </div>
  );
};
