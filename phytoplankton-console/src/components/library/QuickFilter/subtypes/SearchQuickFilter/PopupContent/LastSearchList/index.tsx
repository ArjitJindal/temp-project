import React from 'react';
import { List } from 'antd';
import { useLastSearches } from '../helpers';
import s from './style.module.less';

interface Props {
  localStorageKey: string;
  onSelect: (text: string) => void;
}

export default function LastSearchList(props: Props) {
  const { localStorageKey, onSelect } = props;
  const { items } = useLastSearches(localStorageKey);

  if (items.length === 0) {
    return <></>;
  }
  return (
    <div>
      <div className={s.subtitle}>Recent searches</div>
      <List>
        {items.map((text, i) => (
          <List.Item
            key={i}
            className={s.item}
            onClick={() => {
              onSelect(text);
            }}
          >
            {text}
          </List.Item>
        ))}
      </List>
    </div>
  );
}
