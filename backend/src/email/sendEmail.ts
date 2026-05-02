import { sendRawEmail, type EmailMessage } from "./transport.js";

export async function sendEmail(message: EmailMessage): Promise<void> {
  await sendRawEmail(message);
}
