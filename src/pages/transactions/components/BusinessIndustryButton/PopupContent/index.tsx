import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';

interface Props {
  value: string[];
  onConfirm: (status: string[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  const api = useApi();
  const result = useQuery(USERS_UNIQUES('BUSINESS_INDUSTRY'), () =>
    api.getUsersUniques({ field: 'BUSINESS_INDUSTRY' }),
  );

  return (
    <div className={s.root}>
      <List
        dataSource={getOr(result.data, [])}
        loading={isLoading(result.data)}
        renderItem={(item) => (
          <List.Item
            className={cn(s.item, value.includes(item) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm(!value.includes(item) ? [...value, item] : value.filter((x) => x !== item));
            }}
          >
            <List.Item.Meta title={item} />
          </List.Item>
        )}
      />
    </div>
  );
}
