import { ProColumns } from '@ant-design/pro-table';
import { Link } from 'react-router-dom';
import _ from 'lodash';
import { TableItem } from './types';
import s from './styles.module.less';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';
import Button from '@/components/ui/Button';
import { makeUrl } from '@/utils/routing';
import UserTypeIcon from '@/components/ui/UserTypeIcon';

export const columns: ProColumns<TableItem>[] = [
  {
    title: 'User ID',
    dataIndex: 'originUserId',
    width: '25%',
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
    width: '25%',
    render: (_, { user }) => getUserName(user),
  },
  {
    title: 'Rules hit',
    dataIndex: 'rulesHit',
    width: '25%',
  },
  {
    title: 'User Type',
    width: '25%',
    render: (dom, entity) => {
      const { user } = entity;
      if (user == null) {
        return dom;
      }
      return (
        <div className={s.userType}>
          <UserTypeIcon type={user.type} /> <span>{_.capitalize(user.type)}</span>
        </div>
      );
    },
  },
  {
    title: 'Actions',
    render: (dom, entity) => {
      const { user } = entity;
      if (user == null) {
        return dom;
      }
      return (
        <Link
          to={makeUrl(
            '/case-management/all',
            {},
            {
              originUserId: user.userId,
            },
          )}
        >
          <Button analyticsName="View user cases" size="small" type="ghost">
            View Cases
          </Button>
        </Link>
      );
    },
  },
];
