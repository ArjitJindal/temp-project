import React from 'react';
import cn from 'clsx';
import s from './styles.module.less';

interface Props {
  data: {
    category: string;
    color: string;
  }[];
  highlighted?: string | null;
  onChangeHighlighted?: (category: string | null) => void;
}

export function ColorIndicator(props: { color: string }) {
  return <div className={s.circle} style={{ background: props.color }} />;
}

export default function Legend(props: Props) {
  const { data, highlighted, onChangeHighlighted } = props;

  return (
    <div className={s.root}>
      {data.map((item) => {
        const isShadowed = highlighted != null && highlighted !== item.category;
        return (
          <div
            className={cn(s.item, isShadowed && s.isShadowed)}
            key={item.category}
            onMouseEnter={() => {
              if (onChangeHighlighted != null) {
                onChangeHighlighted(item.category);
              }
            }}
            onMouseLeave={() => {
              if (onChangeHighlighted != null) {
                onChangeHighlighted(null);
              }
            }}
          >
            <ColorIndicator color={item.color} />
            {item.category}
          </div>
        );
      })}
    </div>
  );
}
