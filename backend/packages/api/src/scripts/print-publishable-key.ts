import { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

// Prints the storefront publishable API key token(s) to the logs. The seed
// creates a "Webshop" publishable key but never surfaces its token; the
// storefront needs that pk_... value as NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY.
// Run with: medusa exec ./src/scripts/print-publishable-key.ts
export default async function printPublishableKey({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const { data } = await query.graph({
    entity: 'api_key',
    fields: ['id', 'token', 'title', 'type'],
    filters: { type: 'publishable' },
  });

  if (!data.length) {
    logger.warn('PUBLISHABLE_KEY: none found (run the seed first)');
    return;
  }
  for (const k of data) {
    logger.info(`PUBLISHABLE_KEY token=${k.token} title=${k.title} id=${k.id}`);
  }
}
