// Lightweight liveness endpoint for the DigitalOcean App Platform health check
// (see .do/storefront.app.yaml -> services[].health_check.http_path). Returns a
// cheap 200 so probes don't render the full homepage on `/` every interval.
export function GET() {
  return new Response('ok', { status: 200 });
}
