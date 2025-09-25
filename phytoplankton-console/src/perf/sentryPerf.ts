import { getActiveSpan } from '@sentry/react';
import { Span } from '@sentry/types';

let atfSpan: Span | null = null;
let atfStartMs: number | null = null;
let currentTx: Span | null = null;
let takeNextCommit: boolean = false;
let renderCommitRecorded: boolean = false;

export function getActiveTransaction(): any {
  return getActiveSpan?.();
}

export function routeStarted(routeTemplate: string): void {
  const tx = getActiveTransaction();
  if (!tx) {
    return;
  }
  currentTx = tx as Span;
  try {
    if (atfSpan?.end) {
      atfSpan.end();
    }
  } catch (e) {
    // no-op
  }
  atfSpan = tx.startChild({ op: 'data.atf', description: routeTemplate }) as any;
  atfStartMs = performance.now();
}

export function markAtfReady(): void {
  if (!atfSpan) {
    return;
  }
  const tx = getActiveTransaction();
  const span = atfSpan;
  atfSpan = null;
  try {
    const endMs = performance.now();
    span.end();
    const carrier = (tx as Span) ?? currentTx;
    if (carrier && (carrier as any).setMeasurement && atfStartMs != null) {
      const durationMs = endMs - atfStartMs;
      (carrier as any).setMeasurement('atf_fetch_ms', durationMs, 'millisecond');
    }
  } catch (e) {
    // no-op
  }
  atfStartMs = null;
  // After ATF is ready, record the very next commit as the ATF render cost
  takeNextCommit = true;
  renderCommitRecorded = false;
  // Fallback for production builds where React Profiler might be disabled:
  // use double requestAnimationFrame to capture the time-to-next-paint after ATF is done.
  const fallbackStartMs = performance.now();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (renderCommitRecorded) {
        return; // Profiler already recorded; skip fallback
      }
      const tx2 = (getActiveTransaction() as Span) ?? currentTx;
      if (!tx2) {
        return;
      }
      const delta = performance.now() - fallbackStartMs;
      if ((tx2 as any).setMeasurement) {
        (tx2 as any).setMeasurement('render_commit_ms', delta, 'millisecond');
      }
      const end = performance.now() / 1000;
      const span2 = tx2.startChild({
        op: 'ui.react.commit',
        description: 'render_commit_fallback',
        startTimestamp: end - delta / 1000,
      });
      span2.end(end);
      renderCommitRecorded = true;
      takeNextCommit = false;
    });
  });
}
export function recordRenderCommit(actualDurationMs: number): void {
  if (!takeNextCommit) {
    return; // ignore intermediate commits; we only want the first commit after ATF is ready
  }
  takeNextCommit = false;
  const tx = (getActiveTransaction() as Span) ?? currentTx;
  if (!tx) {
    return;
  }
  if ((tx as any).setMeasurement) {
    (tx as any).setMeasurement('render_commit_ms', actualDurationMs, 'millisecond');
  }
  const end = performance.now() / 1000;
  const span = tx.startChild({
    op: 'ui.react.commit',
    description: 'render_commit',
    startTimestamp: end - actualDurationMs / 1000,
  });
  span.end(end);
  renderCommitRecorded = true;
}

export function recordComponentRender(name: string, actualDurationMs: number, phase: string): void {
  const tx = getActiveTransaction();
  if (!tx) {
    return;
  }
  const end = performance.now() / 1000;
  const span = tx.startChild({
    op: 'ui.react.render',
    description: name,
    data: { phase },
    startTimestamp: end - actualDurationMs / 1000,
  });
  span.end(end);
  try {
    if (tx.setMeasurement) {
      tx.setMeasurement(`render_ms_${name}`, actualDurationMs, 'millisecond');
    }
  } catch (e) {
    // no-op
  }
}
