import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lti/config
 *
 * Returns a tool configuration JSON that NLU IT can reference when
 * registering this tool in Brightspace. For a human-friendly walkthrough
 * of the same values, visit /lti/register in a browser.
 *
 * This config includes both Canvas-style field names (oidc_initiation_url,
 * public_jwk_url) and IMS-standard names (initiate_login_uri, jwks_uri,
 * redirect_uris) so whichever label a Brightspace admin is looking for,
 * it's present here.
 *
 * The tool requests scopes for the Asset Processor flow:
 * - noticehandlers: subscribe to LtiAssetProcessorSubmissionNotice
 * - asset.readonly: download submitted files from the asset service
 * - report: send processing reports back to the platform
 * - lti-ags/lineitem.readonly, result.readonly: assignment metadata
 */
export async function GET() {
  const toolUrl = process.env.LTI_TOOL_URL || 'https://le3-growth-portfolio.vercel.app'
  const vendorContact =
    process.env.LTI_VENDOR_CONTACT_EMAIL || 'contact@le3-growth-portfolio.vercel.app'

  const loginUrl = `${toolUrl}/api/lti/login`
  const launchUrl = `${toolUrl}/api/lti/launch`
  const jwksUrl = `${toolUrl}/api/lti/jwks`

  const config = {
    // ─── Tool metadata ────────────────────────────────
    title: 'LE3 Growth Portfolio',
    description:
      'Student growth portfolio with AI-guided reflective conversations. ' +
      'Students click a link from a course and land in their portfolio to reflect ' +
      'on submitted work. When attached as an Asset Processor to an assignment, ' +
      'the tool automatically receives student submissions and preloads them for reflection.',
    vendor_name: 'LE3 Growth Portfolio',
    vendor_contact_email: vendorContact,
    icon_url: `${toolUrl}/favicon.ico`,
    privacy_policy_url: `${toolUrl}/privacy`,
    terms_of_service_url: `${toolUrl}/terms`,

    // ─── LTI 1.3 endpoints (Canvas-style names) ──────
    oidc_initiation_url: loginUrl,
    target_link_uri: launchUrl,
    public_jwk_url: jwksUrl,
    public_jwk: null,

    // ─── LTI 1.3 endpoints (IMS Security Framework / OIDC standard names) ──
    // Included so Brightspace admins can find whichever label their UI uses
    initiate_login_uri: loginUrl,
    redirect_uris: [launchUrl],
    jwks_uri: jwksUrl,

    // ─── Scopes ───────────────────────────────────────
    scopes: [
      // Platform Notification Service — to register for submission notices
      'https://purl.imsglobal.org/spec/lti/scope/noticehandlers',
      // Asset Service — to download submitted files
      'https://purl.imsglobal.org/spec/lti/scope/asset.readonly',
      // Asset Report Service — to send reports back to the platform
      'https://purl.imsglobal.org/spec/lti/scope/report',
      // AGS — to discover assignment line items for a course
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    ],

    // ─── Placements ───────────────────────────────────
    extensions: [
      {
        platform: 'brightspace.com',
        settings: {
          placements: [
            {
              // Asset Processor: attaches to individual assignment dropboxes
              placement: 'assignment_attachment',
              message_type: 'LtiDeepLinkingRequest',
              accept_types: ['ltiAssetProcessor'],
              target_link_uri: launchUrl,
              icon_url: `${toolUrl}/favicon.ico`,
              text: 'Growth Portfolio',
            },
            {
              // Link selection for course navigation
              placement: 'link_selection',
              message_type: 'LtiDeepLinkingRequest',
              accept_types: ['ltiResourceLink'],
              target_link_uri: launchUrl,
              icon_url: `${toolUrl}/favicon.ico`,
              text: 'Growth Portfolio',
            },
            {
              // Course navigation menu item (direct resource link)
              placement: 'course_navigation',
              message_type: 'LtiResourceLinkRequest',
              target_link_uri: launchUrl,
              icon_url: `${toolUrl}/favicon.ico`,
              text: 'Growth Portfolio',
            },
          ],
        },
      },
    ],

    custom_fields: {},
  }

  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
