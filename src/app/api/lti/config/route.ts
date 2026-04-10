import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lti/config
 *
 * Returns an IMS-style tool configuration JSON that NLU IT can use to
 * register this tool in Brightspace. They can either point Brightspace
 * at this URL directly (auto-registration) or copy the values manually.
 */
export async function GET() {
  const toolUrl = process.env.LTI_TOOL_URL || 'https://le3-growth-portfolio.vercel.app'

  const config = {
    title: 'LE3 Growth Portfolio',
    description:
      'Student growth portfolio with AI-guided reflective conversations. Students click a link from a course and land in their portfolio to reflect on submitted work.',
    oidc_initiation_url: `${toolUrl}/api/lti/login`,
    target_link_uri: `${toolUrl}/api/lti/launch`,
    public_jwk_url: `${toolUrl}/api/lti/jwks`,
    scopes: [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    ],
    extensions: [
      {
        platform: 'brightspace.com',
        settings: {
          placements: [
            {
              placement: 'link_selection',
              message_type: 'LtiDeepLinkingRequest',
              target_link_uri: `${toolUrl}/api/lti/launch`,
            },
            {
              placement: 'course_navigation',
              message_type: 'LtiResourceLinkRequest',
              target_link_uri: `${toolUrl}/api/lti/launch`,
              text: 'Growth Portfolio',
            },
          ],
        },
      },
    ],
    custom_fields: {},
    public_jwk: null,
  }

  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
