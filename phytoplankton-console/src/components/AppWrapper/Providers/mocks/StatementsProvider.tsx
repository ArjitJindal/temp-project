import { StatementsContext } from '../StatementsProvider';

export default function StatementsProviderMock_(props: { children: React.ReactNode }) {
  return (
    <StatementsContext.Provider
      value={{
        statements: [{ actions: ['read', 'write'], resources: ['frn:console:*:::*'] }],
      }}
    >
      {props.children}
    </StatementsContext.Provider>
  );
}
