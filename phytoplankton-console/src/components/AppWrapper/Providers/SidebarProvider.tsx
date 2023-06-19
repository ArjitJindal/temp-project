import { createContext, useContext, useEffect, useState } from 'react';

type CollapseSideBar = 'MANUAL' | 'AUTOMATIC';

const SideBarProvider = (props: { children: React.ReactNode }) => {
  const [collapseSideBar, setCollapseSideBar] = useState<CollapseSideBar>('MANUAL');
  return (
    <SideBarContext.Provider value={{ collapseSideBar, setCollapseSideBar }}>
      {props.children}
    </SideBarContext.Provider>
  );
};

interface SideBarContextType {
  collapseSideBar: CollapseSideBar;
  setCollapseSideBar: (value: CollapseSideBar) => void;
}

export const SideBarContext = createContext<SideBarContextType>({
  collapseSideBar: 'MANUAL',
  setCollapseSideBar: () => null,
});

export default SideBarProvider;

export const useCloseSidebarByDefault = () => {
  const { setCollapseSideBar } = useContext(SideBarContext);

  useEffect(() => {
    setCollapseSideBar('AUTOMATIC');
  }, [setCollapseSideBar]);
};
