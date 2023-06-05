export const getClientOffset = (
  element: HTMLElement,
  stopElement: HTMLElement | null = null,
): {
  left: number;
  top: number;
} => {
  function getOffset(
    element: HTMLElement | null,
    stopElement: HTMLElement | null,
    left = 0,
    top = 0,
  ): {
    left: number;
    top: number;
  } {
    if (!element || element === stopElement) {
      return { left, top };
    }
    return getOffset(
      element.offsetParent as HTMLElement,
      stopElement,
      left + element.offsetLeft,
      top + element.offsetTop,
    );
  }
  return getOffset(element, stopElement);
};
