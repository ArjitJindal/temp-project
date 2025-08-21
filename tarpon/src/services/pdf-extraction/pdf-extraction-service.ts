import PDFParser from 'pdf2json'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'

export interface PDFExtractionOptions {
  removePageBreaks?: boolean
  maxPages?: number
  timeout?: number
}

export interface PDFExtractionResult {
  text: string
  pageCount: number
  extractionTime: number
}

@traceable
export class PDFExtractionService {
  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  private static readonly DEFAULT_MAX_PAGES = 100

  /**
   * Extracts text content from a PDF buffer
   * @param buffer - The PDF file as a Buffer
   * @param options - Extraction options
   * @returns Promise<PDFExtractionResult>
   */
  public async extractText(
    buffer: Buffer,
    options: PDFExtractionOptions = {}
  ): Promise<PDFExtractionResult> {
    const {
      removePageBreaks = true,
      maxPages = PDFExtractionService.DEFAULT_MAX_PAGES,
      timeout = PDFExtractionService.DEFAULT_TIMEOUT,
    } = options

    const startTime = Date.now()

    return new Promise<PDFExtractionResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('PDF extraction timed out'))
      }, timeout)

      const pdfParser = new PDFParser(this, true)

      pdfParser.on('pdfParser_dataError', (errData) => {
        clearTimeout(timeoutId)
        logger.error('Error extracting text from PDF', errData)
        reject(new Error(`PDF parsing failed: ${errData.parserError}`))
      })

      pdfParser.on('pdfParser_dataReady', () => {
        clearTimeout(timeoutId)

        try {
          const rawText = pdfParser.getRawTextContent()
          const pageCount = (pdfParser as any).data.Pages?.length || 0

          if (pageCount > maxPages) {
            return resolve({
              text: '',
              pageCount,
              extractionTime: Date.now() - startTime,
            })
          }

          let processedText = rawText

          if (removePageBreaks) {
            processedText = rawText.replace(
              /----------------Page \(\d+\) Break----------------/g,
              ''
            )
          }

          const extractionTime = Date.now() - startTime

          resolve({
            text: processedText,
            pageCount,
            extractionTime,
          })
        } catch (error) {
          reject(new Error(`Failed to process PDF text: ${error}`))
        }
      })

      try {
        pdfParser.parseBuffer(buffer)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(new Error(`Failed to parse PDF buffer: ${error}`))
      }
    })
  }
}
