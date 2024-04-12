import { OverviewCardSection, SectionProps } from './OverviewCardSection';
import s from './styles.module.less';

interface Props {
  sections: SectionProps[];
}
export const OverviewCard = (props: Props) => {
  const { sections } = props;
  return (
    <div className={s.root}>
      {sections.map((section, index) => (
        <>
          <OverviewCardSection key={index} {...section} />
          {index < sections.length - 1 && <div className={s.divider} />}
        </>
      ))}
    </div>
  );
};
