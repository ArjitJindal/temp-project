import React, { useEffect, useState } from 'react';
import { AsyncResource, success, loading, failed, isSuccess } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { getErrorMessage } from '@/utils/lang';

export function makeAsyncComponent<Props>(
  load: () => Promise<{ default: React.FC<React.PropsWithChildren<Props>> }>,
): React.FC<Props> {
  type ComponentType = React.FC<React.PropsWithChildren<Props>>;

  let cachedComponent: ComponentType;
  async function fetch(): Promise<ComponentType> {
    if (cachedComponent) {
      return cachedComponent;
    }
    const result = await load()
      .then(({ default: Component }) => Component as ComponentType)
      .catch((e) => {
        console.error(e);
        throw e;
      });
    cachedComponent = result;
    return result;
  }

  return function AsyncComponentWrapper(props: React.PropsWithChildren<Props>) {
    const [componentRes, setComponentRes] = useState<AsyncResource<ComponentType>>(() => {
      return cachedComponent ? success(cachedComponent) : loading();
    });
    useEffect(() => {
      if (!isSuccess(componentRes)) {
        fetch()
          .then((Component) => {
            setComponentRes(success(Component));
          })
          .catch((e: unknown) => {
            console.error(e);
            setComponentRes(failed(getErrorMessage(e)));
          });
      }
    }, [componentRes]);
    return (
      <AsyncResourceRenderer resource={componentRes}>
        {(component) => React.createElement(component, props)}
      </AsyncResourceRenderer>
    );
  };
}
