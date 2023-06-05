import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const DownloadAsPDF = (pdfRef: React.MutableRefObject<HTMLInputElement>, pdfName?: string) => {
  return new Promise<void>((resolve, reject) => {
    const input = pdfRef.current;
    html2canvas(input)
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        const doc = new jsPDF('p', 'mm');
        let position = 10;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          doc.addPage();
          doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        doc.save(pdfName + ' Sanctions Details.pdf');
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
};

export default DownloadAsPDF;
