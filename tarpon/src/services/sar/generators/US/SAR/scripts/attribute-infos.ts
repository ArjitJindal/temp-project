export const AttributeInfos: {
  [key: string]: { title?: string; description?: string }
} = {
  EFilingPriorDocumentNumber: {
    title: 'Prior report BSA Identifier (number)',
    description:
      'The BSA Identifier (BSA ID) of the previously-filed FinCEN SAR when filing a correction/amendment and/or a continuing activity report. The value provided must adhere to the following requirements: 14-digit numeric BSA ID (if known); 14 consecutive zeros, i.e. “00000000000000” (if the BSA ID is unknown).',
  },
  FilingDateText: {
    title: 'Filing date',
    description:
      'The date in which the FinCEN SAR is being filed electronically through FinCEN’s BSA E-Filing System. The value provided must adhere to the following requirements: 8 numeric characters in the format YYYYMMDD where YYYY = year, MM = month, and DD = day. Single digit days or months must be prefaced by a zero',
  },
  FilingInstitutionNotetoFinCEN: {
    title: 'Filing Institution Note to FinCEN',
    description:
      'This element allows the filer to alert FinCEN that this FinCEN SAR is being filed in response to a current specific geographic targeting order (GTO) or advisory or other activity. The value provided must adhere to the following requirements: 50 characters or less.',
  },
  ContinuingActivityReportIndicator: {
    title: 'Continuing activity report (indicator)',
    description:
      'This element declares that the FinCEN SAR being filed continues reporting on a previously-reported suspicious activity',
  },
  CorrectsAmendsPriorReportIndicator: {
    title: 'Corrects/Amends prior report (indicator)',
    description:
      'This element declares that the FinCEN SAR being filed corrects or amends a previously-filed FinCEN SAR',
  },
  InitialReportIndicator: {
    title: 'Initial report (indicator)',
    description:
      'This element declares that the FinCEN SAR being filed is the first report filed on the suspicious activity',
  },
  JointReportIndicator: {
    title: 'Joint report (indicator)',
    description:
      'This element declares that the FinCEN SAR is being filed jointly by two or morefinancial institutions.',
  },
  AdmissionConfessionNoIndicator: {
    title: 'Corroborative statement to filer: No (indicator)',
    description:
      'This element declares that the subject individual has made no corroborative statement to the filer',
  },
  AdmissionConfessionYesIndicator: {
    title: 'Corroborative statement to filer: Yes (indicator)',
    description:
      ' This element declares that the subject individual has made a statement to the filer admitting to involvement in or otherwise substantiating the suspicious activity.',
  },
  AllCriticalSubjectInformationUnavailableIndicator: {
    title: 'All critical subject information unavailable (indicator)',
    description:
      'This element declares that all critical subject information is unavailable',
  },
  BirthDateUnknownIndicator: {
    title: 'Date of birth unknown (indicator)',
  },
  // TODO: Keep going. From 'BothPurchaserSenderPayeeReceiveIndicator' in page 30
}
