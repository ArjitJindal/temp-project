import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';

interface Props {
  value: number[];
  onConfirm: (value: number[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  return (
    <div className={s.root}>
      <List
        dataSource={['0', '5', '10', '15', '20', '50', '100']}
        loading={false}
        rowKey={(item) => item}
        renderItem={(item: string) => (
          <List.Item
            className={cn(s.item, value.includes(parseInt(item)) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm([parseInt(item)]);
            }}
          >
            <div className={s.itemTitle}>
              {`> `}
              {item}
            </div>
            {value.includes(parseInt(item)) && <CheckLineIcon className={s.itemIcon} />}
          </List.Item>
        )}
      />
    </div>
  );
}
