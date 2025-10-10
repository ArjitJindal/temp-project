export const downloadLink = (downloadUrl: string, fileName: string, toNewTab: boolean = false) => {
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  if (toNewTab) {
    a.target = '_blank';
  }
  a.click();
};
