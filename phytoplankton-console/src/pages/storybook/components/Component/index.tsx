import React from 'react';
import s from './index.module.less';
import FigmaIcon from './figma-icon.react.svg';
import ErrorBoundary from '@/components/utils/ErrorBoundary';
import Compasses2LineIcon from '@/components/ui/icons/Remix/design/compasses-2-line.react.svg';

export default function Component(props: {
  title: string;
  designLink?: string;
  alternativeNames?: string[];
  children: React.ReactNode;
}) {
  const { alternativeNames = [], designLink, title } = props;
  return (
    <div className={s.root} id={title}>
      <a href={`#${title}`} className={s.title}>
        <Compasses2LineIcon className={s.icon} />
        {title}
      </a>
      {alternativeNames.length > 0 && (
        <div className={s.aka}>AKA: {alternativeNames.join(', ')}</div>
      )}
      {designLink && (
        <a
          className={s.designLink}
          href={designLink}
          target="_blank"
          title="Check out designs for this component"
        >
          <FigmaIcon />
          Designs
        </a>
      )}
      <div className={s.content}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
    </div>
  );
}
