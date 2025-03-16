import React from 'react';
import cn from 'clsx';
import { OverviewCardSection, SectionProps } from './OverviewCardSection';
import s from './styles.module.less';

interface Props {
  sections: SectionProps[];
  highlighted?: boolean;
}
export const OverviewCard = (props: Props) => {
  const { sections, highlighted } = props;
  return (
    <div className={cn(s.root, highlighted && s.highlighted)}>
      {sections.map((section, index) => (
        <React.Fragment key={index}>
          <OverviewCardSection {...section} />
          {index < sections.length - 1 && <div className={s.divider} />}
        </React.Fragment>
      ))}
    </div>
  );
};
