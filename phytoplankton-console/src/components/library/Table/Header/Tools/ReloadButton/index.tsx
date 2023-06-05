import React from 'react';
import s from './styles.module.less';
import RefreshLineIcon from '@/components/ui/icons/Remix/system/refresh-line.react.svg';

interface Props {
  onClick: () => void;
}

export default function ReloadButton(props: Props) {
  const { onClick } = props;

  return <RefreshLineIcon className={s.root} onClick={onClick} />;
}
