import React from 'react';
import Tag from '../index';
import s from './index.module.less';
import { Tag as ApiTag, UserTag } from '@/apis';

interface Props {
  tag: ApiTag | UserTag;
}

export default function KeyValueTag(props: Props) {
  const { tag } = props;
  return (
    <Tag className={s.root} wrapText={false}>
      <span>
        {tag.key}: <span style={{ fontWeight: 700 }}>{tag.value}</span>
      </span>
    </Tag>
  );
}
