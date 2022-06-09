import { ProColumns } from '@ant-design/pro-table';
import { TableItem } from './types';
import { businessName, getFullName } from '@/utils/api/users';
import { neverReturn } from '@/utils/lang';
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
    render: (_, { user }) => {
      if (user == null) {
        return 'N/A';
      }
      if (user.type === 'CONSUMER') {
        return getFullName(user.userDetails);
      }
      if (user.type === 'BUSINESS') {
        return businessName(user);
      }
      return neverReturn(user, 'N/A');
    },
  },
  {
    title: 'Rules hit',
    dataIndex: 'rulesHit',
    width: '33%',
  },
];
