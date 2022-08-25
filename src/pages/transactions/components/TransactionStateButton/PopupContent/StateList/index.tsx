import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { TransactionState } from '@/apis';

interface Props {
  onSelectState: (user: TransactionState | undefined) => void;
}

const data: { State: TransactionState | undefined }[] = [
  {
    State: 'CREATED',
  },
  {
    State: 'PROCESSING',
  },
  {
    State: 'SENT',
  },
  {
    State: 'EXPIRED',
  },
  {
    State: 'SUSPENDED',
  },
  {
    State: 'REFUNDED',
  },
  {
    State: 'SUCCESSFUL',
  },
  {
    State: 'DECLINED',
  },
];

export default function StateList(props: Props) {
  const { onSelectState } = props;

  // todo: i18n
  return (
    <div>
      <div
        id="scrollableDiv"
        style={{
          maxHeight: 200,
          overflow: 'auto',
          width: 200,
        }}
      >
        <List
          dataSource={data}
          renderItem={(value) => (
            <List.Item
              className={cn(s.root)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSelectState(value.State);
              }}
            >
              <List.Item.Meta
                title={
                  <span className={s.userName}>
                    {value.State !== undefined ? value.State : <></>}
                  </span>
                }
              />
            </List.Item>
          )}
        ></List>
      </div>
    </div>
  );
}
