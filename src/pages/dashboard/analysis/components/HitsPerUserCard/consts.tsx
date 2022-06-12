import { ProColumns } from '@ant-design/pro-table';
import { TableItem } from './types';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';

export const columns: ProColumns<TableItem>[] = [
  {
    title: 'User ID',
    dataIndex: 'originUserId',
    width: '33%',
    render: (dom, entity) => {
      const { user } = entity;
      if (user == null) {
        return dom;
      }
      return <UserLink user={user}>{dom}</UserLink>;
    },
  },
  {
    title: 'User Name',
    dataIndex: 'user',
    width: '33%',
    render: (_, { user }) => getUserName(user),
  },
  {
    title: 'Rules hit',
    dataIndex: 'rulesHit',
    width: '33%',
  },
];
