import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { RuleAction } from '@/apis';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';

interface Props {
  onSelectStatus: (user: RuleAction | undefined) => void;
}

const data: { Status: RuleAction | undefined }[] = [
  {
    Status: 'BLOCK',
  },
  {
    Status: 'FLAG',
  },
  {
    Status: 'SUSPEND',
  },
  {
    Status: 'WHITELIST',
  },
];

export default function StatusList(props: Props) {
  const { onSelectStatus } = props;

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
                onSelectStatus(value.Status);
              }}
            >
              <List.Item.Meta
                title={
                  <span className={s.userName}>
                    {value.Status !== undefined ? (
                      <RuleActionStatus ruleAction={value.Status} />
                    ) : (
                      <></>
                    )}
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
