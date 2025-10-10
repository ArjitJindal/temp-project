import { AutoComplete as AntAutoComplete } from 'antd';
import { usePortalContainer } from '@/components/ui/PortalContainerProvider';

type Props = React.ComponentProps<typeof AntAutoComplete>;

export default function AutoComplete(props: Props) {
  const { getPopupContainer } = props;
  const portalContainer = usePortalContainer();
  return (
    <AntAutoComplete
      {...props}
      getPopupContainer={getPopupContainer || portalContainer.getElement}
    />
  );
}
