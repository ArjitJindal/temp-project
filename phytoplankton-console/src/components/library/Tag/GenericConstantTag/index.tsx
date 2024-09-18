import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Tag from '../index';

interface Props {
  children?: string;
}

export default function GenericConstantTag(props: Props) {
  const { children } = props;

  return children ? <Tag>{humanizeConstant(children)}</Tag> : <>{'-'}</>;
}
