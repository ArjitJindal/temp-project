import SubmitButton from './SubmitButton';
import Drawer from '@/components/library/Drawer';

type DrawerProps = {
  onChangeVisibility: (isVisible: boolean) => void;
  isEditDrawer: boolean;
  submitRef: React.RefObject<HTMLButtonElement>;
  isDrawerVisible: boolean;
  children: React.ReactNode;
};

const DrawerForm = (props: DrawerProps) => {
  const { onChangeVisibility, isDrawerVisible, submitRef, children, isEditDrawer } = props;

  return (
    <Drawer
      isVisible={isDrawerVisible}
      onChangeVisibility={onChangeVisibility}
      drawerMaxWidth={'500px'}
      title={`${isEditDrawer ? 'Edit' : 'Create'} narrative template`}
      description={`Fill in the required information ${
        isEditDrawer ? 'to update the' : 'to create a new'
      } narrative template.`}
      footer={<SubmitButton submitRef={submitRef} isEditDrawer={isEditDrawer} />}
    >
      {children}
    </Drawer>
  );
};

export default DrawerForm;
