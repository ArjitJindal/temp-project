import React from 'react';
import Tag from '../index';
import s from './index.module.less';
import { Tag as ApiTag } from '@/apis';

interface Props {
  tag: ApiTag;
}

export default function KeyValueTag(props: Props) {
  const { tag } = props;
  return (
    <Tag className={s.root}>
      <span>
        {tag.key}: <span style={{ fontWeight: 700 }}>{tag.value}</span>
      </span>
    </Tag>
  );
}
