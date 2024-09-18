import React from 'react';
import Tag from '../index';
import { Gender } from '@/apis';
import { neverReturn } from '@/utils/lang';

interface Props {
  children?: Gender;
}

export default function GenderTag(props: Props) {
  const { children } = props;

  let title;
  switch (children) {
    case undefined:
      break;
    case 'M':
      title = 'Male';
      break;
    case 'F':
      title = 'Female';
      break;
    case 'NB':
      title = 'Non-binary';
      break;
    default:
      title = neverReturn(children, children);
  }
  return title ? <Tag>{title}</Tag> : <>{'-'}</>;
}
