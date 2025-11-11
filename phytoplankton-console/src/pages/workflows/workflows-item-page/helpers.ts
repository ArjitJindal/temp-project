import { Dispatch, useReducer } from 'react';
import { AsyncResource, init, map } from '@/utils/asyncResource';

type LoadAsyncResourceAction<T> = {
  type: 'LOAD_ASYNC_RESOURCE';
  payload: AsyncResource<T>;
};

function isLoadAsyncResourceAction<T>(
  action: unknown | LoadAsyncResourceAction<T>,
): action is LoadAsyncResourceAction<T> {
  return (
    action != null &&
    typeof action === 'object' &&
    'type' in action &&
    action.type === 'LOAD_ASYNC_RESOURCE'
  );
}

export function useReducerWrapper<State, Actions>(
  reducer: (state: State, action: Actions) => State,
  initialValue?: AsyncResource<State>,
): [AsyncResource<State>, Dispatch<Actions | LoadAsyncResourceAction<State>>] {
  return useReducer(
    (state: AsyncResource<State>, action: Actions | LoadAsyncResourceAction<State>) => {
      if (isLoadAsyncResourceAction(action)) {
        return action.payload;
      }
      return map(state, (state) => {
        return reducer(state, action);
      });
    },
    initialValue ?? init<State>(),
  );
}
