import s from './styles.module.less';

export interface SectionProps {
  title: string;
  value: string | number;
  description?: string;
}

export const OverviewCardSection = (props: SectionProps) => {
  const { title, value, description } = props;
  return (
    <div className={s.section}>
      <div className={s.title}>{title}</div>
      <div className={s.body}>
        <div className={s.value}>{value}</div>
        {description && <div className={s.description}>{description}</div>}
      </div>
    </div>
  );
};
