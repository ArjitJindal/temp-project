import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { BUSINESS_USERS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading, map } from '@/utils/asyncResource';

interface Props {
  value: string[];
  onConfirm: (status: string[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  const api = useApi();
  const result = useQuery(BUSINESS_USERS_UNIQUES(), () => api.getUsersUniques());
  const businessIndustryRes = map(result.data, ({ businessIndustry }) => businessIndustry);

  return (
    <div className={s.root}>
      <div
        id="scrollableDiv"
        style={{
          maxHeight: 200,
          overflow: 'auto',
          width: 200,
        }}
      >
        <List
          dataSource={getOr(businessIndustryRes, [])}
          loading={isLoading(businessIndustryRes)}
          renderItem={(item) => (
            <List.Item
              className={cn(s.item, value.includes(item) && s.isActive)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onConfirm(
                  !value.includes(item) ? [...value, item] : value.filter((x) => x !== item),
                );
              }}
            >
              <List.Item.Meta title={item} />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
