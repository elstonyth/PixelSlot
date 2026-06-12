import type { ICustomerModuleService, CustomerDTO } from "@medusajs/types";

type CustomerFilters = Parameters<ICustomerModuleService["listCustomers"]>[0];

/**
 * Resolves a customer by their public profile handle (customer
 * metadata.handle — written by the ensure-profile-handle workflow and the
 * seed script). `metadata` is a JSONB column; MikroORM translates the nested
 * object into a JSON-path equality, but the customer filter DTO doesn't
 * declare metadata, hence the cast. Exercised by public-profile.spec.ts.
 */
export async function findCustomerByHandle(
  customers: ICustomerModuleService,
  handle: string,
): Promise<CustomerDTO | null> {
  const matches = await customers.listCustomers(
    { metadata: { handle } } as unknown as CustomerFilters,
    { take: 1 },
  );
  return matches[0] ?? null;
}
