export type ContactFile = {
  id: string;
  emailMessageId: string;
  attachmentId: string;
  partId: string;
  fileName: string;
  mimeType: string;
  size: number;
  direction: 'sent' | 'received';
  emailSubject: string;
  emailDate: string;
  emailFrom: string;
  emailTo: string[];
};

