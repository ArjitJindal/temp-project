import { BrowserSupportModal } from './BrowserSupportModal';
import { useCurrentUser } from '@/utils/user-utils';

interface Props {
  children?: React.ReactNode;
}

export const BrowserSupportProvider = (props: Props) => {
  const currentUser = useCurrentUser();
  return (
    <>
      {currentUser?.email && !currentUser.email.includes('cypress') ? (
        <BrowserSupportModal />
      ) : null}
      {props.children}
    </>
  );
};
