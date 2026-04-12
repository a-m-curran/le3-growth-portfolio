import RegisterClient from './RegisterClient'

/**
 * Server component wrapper for the LTI registration helper page.
 *
 * Reads LTI_TOOL_URL and LTI_VENDOR_CONTACT_EMAIL from the environment
 * on every request so updating those env vars takes effect immediately
 * without requiring a rebuild.
 */
export const metadata = {
  title: 'LTI Registration Helper — LE3 Growth Portfolio',
}

export const dynamic = 'force-dynamic'

export default function LtiRegisterPage() {
  const toolUrl = process.env.LTI_TOOL_URL || 'https://le3-growth-portfolio.vercel.app'
  const vendorContact =
    process.env.LTI_VENDOR_CONTACT_EMAIL || 'contact@le3-growth-portfolio.vercel.app'

  return <RegisterClient toolUrl={toolUrl} vendorContact={vendorContact} />
}
