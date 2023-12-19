import React from 'react';
import s from './index.module.less';
import ImageSafariSvg from './image-safari.react.svg';
import { isWhiteLabeled } from '@/utils/branding';
import Spinner from '@/components/library/Spinner';

export function PageLoading() {
  return (
    <div className={s.root}>
      {isWhiteLabeled() ? <Spinner /> : <ImageSafariSvg className={s.image} />}
    </div>
  );
}
