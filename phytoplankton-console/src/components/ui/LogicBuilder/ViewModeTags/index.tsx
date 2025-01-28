import React from 'react';
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
  return (
    <div className={s.root}>
      {Array.isArray(props.children) ? (
        props.children.map((child, i) => <ValueTag key={i}>{child}</ValueTag>)
      ) : (
        <ValueTag color={props.color}>{props.children ?? 'N/A'}</ValueTag>
      )}
    </div>
  );
}
