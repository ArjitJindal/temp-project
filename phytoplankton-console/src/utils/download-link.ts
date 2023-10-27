export const downloadLink = (downloadUrl: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  a.click();
};
