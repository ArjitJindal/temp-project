import React, { useCallback } from 'react';
import { Avatar, List, Typography } from 'antd';
import cn from 'clsx';
import { colorSchema } from '../../AssigneesDropdown/utils';
import s from './style.module.less';
import { useUsers } from '@/utils/user-utils';

interface Props {
  value: string[];
  onConfirm: (users: string[]) => void;
}

const UNASSIGNED = 'Unassigned';

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;
  const [users, loading] = useUsers();

  const isSelected = useCallback(
    (user: string) => {
      if (value?.length === 0) {
        return false;
      }

      const userId =
        user === UNASSIGNED
          ? UNASSIGNED
          : Object.keys(users).find((key) => users[key].name === user);
      if (!userId) {
        return false;
      }

      return value.includes(userId);
    },
    [value, users],
  );
  const options = [UNASSIGNED, ...Object.keys(users).map((key) => users[key].name)];
  return (
    <div className={s.root}>
      <List
        dataSource={options}
        loading={loading}
        rowKey={(item) => item}
        className={s.list}
        renderItem={(user: string) => {
          const randomColor = colorSchema[Math.floor(Math.random() * colorSchema.length)];

          return (
            <List.Item
              className={cn(s.item, value?.length > 0 && isSelected(user) && s.isActive)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const userId =
                  user === UNASSIGNED
                    ? UNASSIGNED
                    : Object.keys(users).find((key) => users[key].name === user);

                if (!userId) {
                  return;
                }

                let onConfirmValue: string[] = [userId];

                if (value?.length > 0) {
                  if (value.includes(userId)) {
                    onConfirmValue = value.filter((x) => x !== userId);
                  } else {
                    onConfirmValue = [...value, userId];
                  }
                }

                onConfirm(onConfirmValue);
              }}
            >
              <div className={s.user}>
                {user !== UNASSIGNED && (
                  <Avatar
                    size="small"
                    className={s.avatar}
                    style={{ backgroundColor: randomColor.background, color: randomColor.text }}
                  >
                    {user.slice(0, 2).toUpperCase()}
                  </Avatar>
                )}
                <Typography.Text>{user}</Typography.Text>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
}
