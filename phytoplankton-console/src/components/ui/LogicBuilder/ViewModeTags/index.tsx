import React, { Children } from 'react';
import s from './index.module.less';
import Tag, { TagColor } from '@/components/library/Tag';

function ValueTag(props: { color?: TagColor; children: React.ReactNode | undefined | null }) {
  return (
    <Tag color={props.color} trimText={false}>
      {props.children ?? 'N/A'}
    </Tag>
  );
}

export default function ViewModeTags(props: {
  color?: TagColor;
  children: React.ReactNode | React.ReactNode[] | undefined | null | false;
}) {
  const flattenedChildren = Children.toArray(props.children).filter(Boolean);

  return (
    <div className={s.root}>
      <ValueTag color={props.color}>
        {flattenedChildren.map((node, i) => (
          <React.Fragment key={i}>
            {i !== 0 && ', '}
            {node}
          </React.Fragment>
        ))}
      </ValueTag>
    </div>
  );
}
