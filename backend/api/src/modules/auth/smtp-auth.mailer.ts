import nodemailer from 'nodemailer';
import type { ApiEnvironment } from '@zorfly/config';
import type { AuthMailer, MailMessage } from './auth.types.js';

export class SmtpAuthMailer implements AuthMailer {
  private readonly transport;

  public constructor(private readonly environment: ApiEnvironment) {
    this.transport = nodemailer.createTransport({
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_SECURE
    });
  }

  public async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.environment.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      headers: {
        'X-Zorfly-Message-Type': message.type,
        ...(message.tenantId ? { 'X-Zorfly-Tenant-Id': message.tenantId } : {})
      }
    });
  }
}
