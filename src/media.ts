import fs from 'fs';

export interface Attachment {
  url: string;
  contentType: string;
}

export async function prepareMediaData(attachments: Attachment[]): Promise<{ data: Buffer; mediaType: string }[]> {
  return Promise.all(
    attachments.map(async (attachment) => {
      const data = await fs.promises.readFile(attachment.url);
      return { data, mediaType: attachment.contentType };
    })
  );
} 