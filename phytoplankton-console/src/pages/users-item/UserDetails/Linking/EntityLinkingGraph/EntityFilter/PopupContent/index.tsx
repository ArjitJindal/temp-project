import { capitalizeWords, firstLetterUpper } from '@flagright/lib/utils/humanize';
import { List } from 'antd';
import cn from 'clsx';
import { EntitiesEnum } from '../../../UserGraph';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  value: EntitiesEnum[];
  onConfirm: (value: EntitiesEnum[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;
  const settings = useSettings();

  const getDisplayName = (item: EntitiesEnum) => {
    if (item === 'user') {
      return firstLetterUpper(settings.userAlias);
    }
    return capitalizeWords(item);
  };

  return (
    <div className={s.root}>
      <List
        dataSource={['all', 'user', 'payment-identifier'] as EntitiesEnum[]}
        loading={false}
        rowKey={(item) => item}
        renderItem={(item) => (
          <List.Item
            className={cn(s.item, value.includes(item) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm([item]);
            }}
          >
            <div className={s.itemTitle}>{getDisplayName(item)}</div>
            {value.includes(item) && <CheckLineIcon className={s.itemIcon} />}
          </List.Item>
        )}
      />
    </div>
  );
}
