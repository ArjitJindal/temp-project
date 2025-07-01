import { useCallback } from 'react';
import { List, Avatar } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { colorSchema } from '@/components/utils/AssigneesDropdown/utils';
import { useSortedUsers } from '@/utils/user-utils';

interface Props {
  value: string[];
  onConfirm: (users: string[]) => void;
  includeUnassigned?: boolean;
}

const UNASSIGNED = 'Unassigned';

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;
  const [users, loading] = useSortedUsers();

  const isSelected = useCallback(
    (user: string) => {
      if (value?.length === 0) {
        return false;
      }

      const userId = user === UNASSIGNED ? UNASSIGNED : users.find((u) => u.name === user)?.id;
      if (!userId) {
        return false;
      }

      return value.includes(userId);
    },
    [value, users],
  );
  const options = props?.includeUnassigned
    ? [UNASSIGNED, ...users.map((u) => u.name)]
    : [...users.map((u) => u.name)];
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
                  user === UNASSIGNED ? UNASSIGNED : users.find((u) => u.name === user)?.id;

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
                    style={{
                      backgroundColor: randomColor.background,
                      color: randomColor.text,
                      marginRight: '8px',
                    }}
                  >
                    {user.slice(0, 2).toUpperCase()}
                  </Avatar>
                )}
                <span>{user}</span>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
}
