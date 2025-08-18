import { ReactNode, createContext, useContext, useMemo } from 'react';

/*
  This component is more a hack, which allows to define default portal target for components. This
  is useful when you need a portal to overcome overflow: hidden on parent elements, but want to
  use fixed absolute positioned elements inside the scrolling container. Without this component,
  you would have to update component position on scroll, which is flaky and not performant.
 */
type FloatingPortalContainerProvider = {
  getElement: () => HTMLElement;
};
const Context = createContext<FloatingPortalContainerProvider | null>(null);

type Props = {
  getElement: () => HTMLElement;
  children: ReactNode;
};

export default function PortalContainerProvider(props: Props) {
  const { getElement } = props;
  const contextValue = useMemo(() => {
    return {
      getElement,
    };
  }, [getElement]);
  return <Context.Provider value={contextValue}>{props.children}</Context.Provider>;
}

export function usePortalContainer(): FloatingPortalContainerProvider {
  const context = useContext(Context);
  if (context) {
    return context;
  }
  return {
    getElement: () => {
      return document.body;
    },
  };
}
