import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { DashboardModuleOptions } from '@mercurjs/types'
import path from 'path'
loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Secrets pass through UNDEFINED when unset so Medusa's own ConfigManager
// gate stays live: it already fail-fasts in production on a missing
// jwtSecret/cookieSecret and applies the "supersecret" dev default (with a
// warning) otherwise — a local `|| "supersecret"` fallback here would feed it
// a "found" value and mute that gate. The one case the framework can't catch
// is a secret EXPLICITLY set to the known dev literal; reject that ourselves,
// using the framework's own definition of production ("production" or
// "prod"). Generation one-liner lives in .env.template's PROD CHECKLIST.
const isProduction = ['production', 'prod'].includes(process.env.NODE_ENV || '')
const secretFromEnv = (name: 'JWT_SECRET' | 'COOKIE_SECRET'): string | undefined => {
  const value = process.env[name]
  if (isProduction && value === 'supersecret') {
    throw new Error(
      `${name} must be set to a strong random value in production (see .env.template)`
    )
  }
  return value
}

module.exports = defineConfig({
  // Bundled Medusa admin (/app) disabled — this Mercur project serves its own
  // admin (/dashboard) + vendor (/seller) dashboards via the *-ui modules below
  // (and the apps/admin + apps/vendor dev servers). Disabling avoids the default
  // admin loader requiring a bundled index.html at `medusa start`.
  admin: { disable: true },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      // @ts-expect-error: vendorCors is not defined in medusa config module
      vendorCors: process.env.VENDOR_CORS!,
      jwtSecret: secretFromEnv('JWT_SECRET'),
      cookieSecret: secretFromEnv('COOKIE_SECRET'),
    }
  },
  featureFlags: {
    rbac: true,
    seller_registration: true
  },
  modules: [
    {
      resolve: "@medusajs/medusa/rbac",
    },
    {
      // Custom gacha Packs module — Phase 4 ships the Pack catalog model; the
      // gacha internals (odds/pulls) land in Phase 5. See src/modules/packs.
      resolve: "./src/modules/packs",
    },
    {
      resolve: '@mercurjs/core/modules/admin-ui',
      options: {
        appDir: path.join(__dirname, '../../apps/admin'),
        path: '/dashboard',
      } as DashboardModuleOptions
    },
    {
      resolve: '@mercurjs/core/modules/vendor-ui',
      options: {
        appDir: path.join(__dirname, '../../apps/vendor'),
        path: '/seller',
      } as DashboardModuleOptions
    },
  ],
  plugins: [{
    resolve: "@mercurjs/core",
    options: {}
  }]
})
