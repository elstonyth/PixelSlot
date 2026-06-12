import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ensureProfileHandleWorkflow } from "../../../../workflows/ensure-profile-handle";

// GET /store/profiles/me — the logged-in customer's public profile handle,
// assigned lazily on first request (idempotent — see the workflow). The
// storefront uses this to build the "My Profile" link; the profile data
// itself comes from the public GET /store/profiles/:handle like any other
// visitor would see it.
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { result } = await ensureProfileHandleWorkflow(req.scope).run({
    input: { customer_id: req.auth_context.actor_id },
  });
  res.json({ handle: result.handle });
}
