import { BrowserSupportModal } from '@/components/BrowserSupportModal';

interface Props {
  children?: React.ReactNode;
}

export const BrowserSupportProvider = (props: Props) => {
  return (
    <>
      <BrowserSupportModal />
      {props.children}
    </>
  );
};
