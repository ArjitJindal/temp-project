import s from './style.module.less';
import Button from '@/components/library/Button';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';

type SubmitButtonProps = {
  submitRef: React.RefObject<HTMLButtonElement>;
  isEditDrawer: boolean;
};

const SubmitButton = (props: SubmitButtonProps) => {
  const { submitRef, isEditDrawer } = props;

  return (
    <div className={s.footer}>
      <Button
        type="PRIMARY"
        size="MEDIUM"
        style={{ width: '100%' }}
        icon={!isEditDrawer ? <AddLineIcon /> : undefined}
        onClick={() => submitRef.current?.click()}
        requiredPermissions={['settings:organisation:write']}
      >
        {isEditDrawer ? 'Save' : 'Create'} template
      </Button>
    </div>
  );
};

export default SubmitButton;
