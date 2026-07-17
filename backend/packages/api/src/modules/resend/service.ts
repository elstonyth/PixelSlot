import {
  AbstractNotificationProviderService,
  MedusaError,
} from '@medusajs/framework/utils';
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types';
import { Resend } from 'resend';
import { renderTemplate } from './templates';

export type ResendOptions = {
  api_key: string;
  from: string;
  reply_to?: string;
};

type InjectedDependencies = { logger: Logger };

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = 'notification-resend';

  private readonly resendClient: Resend;
  private readonly options: ResendOptions;
  private readonly logger: Logger;

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    this.resendClient = new Resend(options.api_key);
    this.options = options;
    this.logger = logger;
  }

  // Runs at module registration. medusa-config.ts only registers this provider when
  // isResendConfigured() passes (both api_key and from present), so in practice this
  // is a second line of defence rather than the primary gate — but it keeps the
  // provider honest if it is ever registered from somewhere else.
  static validateOptions(options: Record<string, unknown>): void {
    for (const key of ['api_key', 'from'] as const) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Resend notification provider requires \`${key}\` in its options.`,
        );
      }
    }
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const rendered = renderTemplate(
      notification.template,
      notification.data as Record<string, unknown> | undefined,
    );

    if (!rendered) {
      // PERMANENT failure: an unknown template or a malformed payload will fail
      // identically on every redelivery, so this returns instead of throwing —
      // throwing would put the event into a retry loop that can never succeed.
      // Names the template only — see the SECURITY note on the error path below.
      this.logger.error(
        `[resend] no renderable email template named "${notification.template}"`,
      );
      return {};
    }

    const { data, error } = await this.resendClient.emails.send({
      from: this.options.from,
      to: [notification.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(this.options.reply_to ? { replyTo: this.options.reply_to } : {}),
    });

    if (error || !data) {
      // SECURITY (CWE-532, same invariant as subscribers/password-reset.ts): the
      // message carries the template name and Resend's error ONLY. Never include
      // `notification` or `notification.data` — the password-reset payload holds the
      // single-use reset link, this path runs in PRODUCTION, and the message below is
      // both logged and wrapped into the thrown MedusaError. That is exactly what the
      // subscriber's dev/test gate exists to keep out of the logs; anyone with log
      // access could otherwise complete an account takeover.
      const message = `[resend] failed to send "${notification.template}": ${
        error?.message ?? 'unknown error'
      }`;
      this.logger.error(message);

      // TRANSIENT failure (rate limit, 5xx, network): throw so the caller records
      // status FAILURE and the event bus redelivers. Returning here instead would be
      // silently lossy — @medusajs/notification only runs its failure branch when the
      // provider THROWS (notification-module-service.js:95); a plain return falls
      // through to `status = SUCCESS` with an undefined external_id, so a Resend
      // outage would look like a delivered email and never retry.
      //
      // Redelivery is safe: the retried event replays the SAME token, so the customer
      // can receive a duplicate of an identical link, never a conflicting one.
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message);
    }

    return { id: data.id };
  }
}

export default ResendNotificationProviderService;
