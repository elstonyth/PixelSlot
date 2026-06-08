import { defineMiddlewares, authenticate } from "@medusajs/framework/http";

// Custom-route middleware. /store/* is NOT a default customer-protected prefix
// (only /store/customers/me/* is), so the open-pack route must opt in to customer
// auth explicitly. The matcher targets only the `/open` sub-path so the public,
// publishable-key-scoped GET /store/packs/:slug (5a detail) and GET /store/packs
// (catalog) stay anonymous — verified by the middleware-regression probe.
export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/packs/*/open",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
  ],
});
