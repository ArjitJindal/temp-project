import { ResizeCallbackData } from 'react-resizable';

const handleResize =
  (
    index: number,
    setUpdatedColumnWidth: React.Dispatch<
      React.SetStateAction<{
        [key: number]: number;
      }>
    >,
  ) =>
  (_: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    setUpdatedColumnWidth((prev) => ({
      ...prev,
      [index]: size.width,
    }));
  };

export default handleResize;
