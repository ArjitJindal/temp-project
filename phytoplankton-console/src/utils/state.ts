import { Dispatch } from 'react';

export type UpdaterFunction<S> = (prevState: S) => S;
export type Updater<S> = S | UpdaterFunction<S>;
export type StatePair<T> = [T, Dispatch<Updater<T>>];

export function applyUpdater<T>(value: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (prevState: T) => T)(value) : updater;
}
