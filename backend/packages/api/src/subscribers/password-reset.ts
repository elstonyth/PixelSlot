import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";

// Dev-mode "mail" delivery for the forgot-password flow: until a real
// notification provider (Resend/SendGrid) lands, the reset link is logged at
// WARN so it stands out in (and is greppable from) the backend console.
// Swapping in real mail later means replacing the logger call with a
// notification-module send — the event payload and link stay the same.
//
// Payload of auth.password_reset (emitted by core's
// generateResetPasswordTokenWorkflow): entity_id = the identifier the actor
// typed (their email for emailpass), actor_type = "customer" | "user" | ...,
// token = the 15m single-use reset JWT.
export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<{ entity_id: string; actor_type: string; token: string }>) {
  const logger = container.resolve("logger");

  // Only customers have a storefront reset page. Other actor types (admin
  // users reset via their own dashboards) still get the token logged so a
  // dev can complete the flow by hand.
  if (data.actor_type !== "customer") {
    logger.warn(
      `[password-reset] reset requested for ${data.actor_type} "${data.entity_id}" — no storefront page for this actor type; token: ${data.token}`,
    );
    return;
  }

  const base = (process.env.STOREFRONT_URL ?? "http://localhost:4000").replace(
    /\/+$/,
    "",
  );
  const url = `${base}/reset-password?token=${encodeURIComponent(
    data.token,
  )}&email=${encodeURIComponent(data.entity_id)}`;

  logger.warn(`[password-reset] reset link for ${data.entity_id}: ${url}`);
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
};
