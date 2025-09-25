import React, { Profiler, ComponentType } from 'react';
import { recordComponentRender } from './sentryPerf';

export function withRenderPerf<T>(Component: ComponentType<T>, name?: string) {
  const id = name ?? (Component as any).displayName ?? Component.name ?? 'Component';
  const Wrapped = (props: T) => {
    return (
      <Profiler
        id={id}
        onRender={(_, phase, actualDuration) => recordComponentRender(id, actualDuration, phase)}
      >
        <Component {...(props as any)} />
      </Profiler>
    );
  };
  (Wrapped as any).displayName = `WithRenderPerf(${id})`;
  return Wrapped;
}
