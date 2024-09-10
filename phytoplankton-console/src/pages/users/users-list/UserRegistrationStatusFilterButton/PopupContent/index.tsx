import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import { UserRegistrationStatus } from '@/apis';
import { USER_REGISTRATION_STATUSS } from '@/apis/models-custom/UserRegistrationStatus';
import COLORS from '@/components/ui/colors';

interface Props {
  value: UserRegistrationStatus[];
  onConfirm: (value: UserRegistrationStatus[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  return (
    <div className={s.root}>
      <List
        dataSource={USER_REGISTRATION_STATUSS}
        loading={false}
        rowKey={(item) => item}
        renderItem={(item: UserRegistrationStatus) => (
          <List.Item
            className={cn(s.item, value.includes(item) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm(!value.includes(item) ? [...value, item] : value.filter((x) => x !== item));
            }}
          >
            <div className={s.itemTitle}>{capitalizeWords(item)}</div>
            {value.includes(item) && (
              <CheckLineIcon
                className={s.itemIcon}
                style={{ width: '1rem', height: '1rem', color: COLORS.brandBlue.base }}
              />
            )}
          </List.Item>
        )}
      />
    </div>
  );
}
