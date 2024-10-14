import { useEffect, useState } from 'react';

export async function copyTextToClipboard(text: string) {
  if (!navigator.clipboard) {
    // todo: i18n
    throw new Error(`Sorry, you browser doesn't support this operation`);
  }
  await navigator.clipboard.writeText(text);
}

export function downloadUrl(filename: string | undefined, url: string) {
  const element = document.createElement('a');
  element.setAttribute('href', url);
  if (filename) {
    element.setAttribute('download', filename);
  }
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function download(filename: string, text: string) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function isDeepChild(parent: HTMLElement | null, el: HTMLElement | null) {
  if (parent == null || el == null) {
    return false;
  }
  let next: HTMLElement | null = el;
  while (next != null) {
    if (next == parent) {
      return true;
    }
    next = next.parentElement;
  }
  return false;
}

export function useElementSize(el: HTMLElement | null): { width: number; height: number } | null {
  const [rect, setRect] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (el != null) {
      setRect(el.getBoundingClientRect());
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.borderBoxSize.length > 0) {
            const boxSize = entry.borderBoxSize[0];
            setRect({
              width: boxSize.inlineSize,
              height: boxSize.blockSize,
            });
          } else {
            setRect(el.getBoundingClientRect());
          }
        }
      });
      resizeObserver.observe(el);
      return () => {
        resizeObserver.unobserve(el);
      };
    }
  }, [el]);
  return rect;
}

export function useElementSizeChangeEffect(
  el: HTMLElement | null,
  cb: ResizeObserverCallback,
): void {
  useEffect(() => {
    if (el != null) {
      const resizeObserver = new ResizeObserver(cb);
      resizeObserver.observe(el);
      return () => {
        resizeObserver.unobserve(el);
      };
    }
  }, [el, cb]);
}

export function escapeHtml(unsafe: unknown): string {
  return `${unsafe}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function scrollTo(
  el: HTMLElement,
  params: {
    top: number;
    smooth: boolean;
  },
  cb: () => void,
) {
  const { top, smooth } = params;
  if (el) {
    el.scrollTo({
      top,
      behavior: smooth ? 'smooth' : 'instant',
    });
    if (smooth) {
      const interval = setInterval(() => {
        const dif = Math.abs(el.scrollTop - top);
        if (dif < 10) {
          cb();
          clearInterval(interval);
        }
      }, 100);
    } else {
      cb();
    }
  }
}
