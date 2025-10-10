import { List } from 'antd';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './style.module.less';
import { PAYMENT_METHODS } from '@/utils/payments';

interface Props {
  value: string[];
  onConfirm: (status: string[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;
  return (
    <div className={s.root}>
      <List
        dataSource={PAYMENT_METHODS.map((x) => ({
          value: x,
          label: humanizeConstant(x),
        }))}
        renderItem={(item) => (
          <List.Item
            className={cn(s.item, value.includes(item.value) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm(
                !value.includes(item.value)
                  ? [...value, item.value]
                  : value.filter((x) => x !== item.value),
              );
            }}
          >
            <List.Item.Meta title={item.label} />
          </List.Item>
        )}
      />
    </div>
  );
}
