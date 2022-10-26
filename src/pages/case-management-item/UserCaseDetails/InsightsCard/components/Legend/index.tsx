import React from 'react';
import s from './styles.module.less';

interface Props {
  data: {
    category: string;
    color: string;
  }[];
}

export function ColorIndicator(props: { color: string }) {
  return <div className={s.circle} style={{ background: props.color }} />;
}

export default function Legend(props: Props) {
  const { data } = props;

  return (
    <div className={s.root}>
      {data.map((item) => (
        <div className={s.item} key={item.category}>
          <ColorIndicator color={item.color} />
          {item.category}
        </div>
      ))}
    </div>
  );
}
