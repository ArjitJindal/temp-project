import { capitalizeWords } from '@flagright/lib/utils/humanize';
import { List } from 'antd';
import cn from 'clsx';
import { EntitiesEnum } from '../../../UserGraph';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';

interface Props {
  value: EntitiesEnum[];
  onConfirm: (value: EntitiesEnum[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  return (
    <div className={s.root}>
      <List
        dataSource={['all', 'user', 'payment-identifier'] as EntitiesEnum[]}
        loading={false}
        rowKey={(item) => item}
        renderItem={(item: EntitiesEnum) => (
          <List.Item
            className={cn(s.item, value.includes(item) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm([item]);
            }}
          >
            <div className={s.itemTitle}>{capitalizeWords(item)}</div>
            {value.includes(item) && <CheckLineIcon className={s.itemIcon} />}
          </List.Item>
        )}
      />
    </div>
  );
}
