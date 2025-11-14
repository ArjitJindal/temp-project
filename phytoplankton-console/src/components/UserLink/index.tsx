import { getUserLink } from '@/utils/api/users/helpers';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import Link from '@/components/ui/Link';

interface Props {
  user: Pick<TableUser, 'type' | 'userId'> | null;
  children?: string;
  testName?: string;
}

export default function UserLink(props: Props) {
  const { user, children, testName } = props;
  const userLink = getUserLink(user);
  return (
    <Link to={userLink ?? '#'} data-cy={testName}>
      {children}
    </Link>
  );
}
