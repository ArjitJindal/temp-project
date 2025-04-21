import React, { useCallback, useState } from 'react';
import { Typography } from 'antd';
import Icon from './icon-judge.react.svg';
import s from './index.module.less';
import Spam2FillIcon from '@/components/ui/icons/Remix/system/spam-2-fill.react.svg';
import Modal from '@/components/library/Modal';
import COLORS from '@/components/ui/colors';
import { ListHeaderInternal, ListType } from '@/apis';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { message } from '@/components/library/Message';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props {
  listType: ListType;
  list: ListHeaderInternal | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function DeleteListModal(props: Props) {
  const api = useApi();
  const settings = useSettings();
  const { list, onCancel, onSuccess } = props;

  const isOpen = list != null;
  const [isLoading, setLoading] = useState(false);
  const listId = list?.listId;
  const listType = list?.listType;
  const handleOk = useCallback(() => {
    if (listId != null && listType != null) {
      setLoading(true);
      const promise =
        listType === 'WHITELIST'
          ? api.deleteWhiteList({ listId })
          : api.deleteBlacklist({ listId });

      promise
        .then(
          () => {
            message.success('List deleted!');
            onSuccess();
          },
          (e) => {
            message.fatal(`Unable to delete list! ${getErrorMessage(e)}`, e);
          },
        )
        .finally(() => {
          setLoading(false);
        });
    }
  }, [onSuccess, listId, listType, api]);

  // todo: i18n
  return (
    <Modal
      icon={<Icon />}
      title={'Delete List'}
      isOpen={isOpen}
      onCancel={onCancel}
      onOk={handleOk}
      okText={'Delete'}
      okProps={{ type: 'DANGER', isLoading: isLoading }}
      writePermissions={
        listType === 'WHITELIST' ? ['lists:whitelist:write'] : ['lists:blacklist:write']
      }
    >
      <div className={s.title}>
        <Spam2FillIcon className={s.icon} />
        <Typography.Paragraph>
          <b>Are you sure you want to delete the “{list?.metadata?.name}” list?</b>
        </Typography.Paragraph>
      </div>
      <Typography.Paragraph style={{ color: COLORS.purpleGray.base }}>
        Deleting this list will remove all <b>{list?.size}</b> {settings.userAlias}s from this{' '}
        {listType === 'WHITELIST' ? ' whitelist ' : ' blacklist'}. This cannot be undone so please
        consider this carefully.
      </Typography.Paragraph>
    </Modal>
  );
}
