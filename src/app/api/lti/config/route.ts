import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lti/config
 *
 * Returns an IMS-style tool configuration JSON that NLU IT can use to
 * register this tool in Brightspace. They can either point Brightspace
 * at this URL directly (auto-registration) or copy the values manually.
 *
 * The tool requests scopes for the Asset Processor flow:
 * - noticehandlers: subscribe to LtiAssetProcessorSubmissionNotice
 * - asset.readonly: download submitted files from the asset service
 * - report: send processing reports back to the platform
 */
export async function GET() {
  const toolUrl = process.env.LTI_TOOL_URL || 'https://le3-growth-portfolio.vercel.app'

  const config = {
    title: 'LE3 Growth Portfolio',
    description:
      'Student growth portfolio with AI-guided reflective conversations. ' +
      'Students click a link from a course and land in their portfolio to reflect ' +
      'on submitted work. When attached as an Asset Processor to an assignment, ' +
      'the tool automatically receives student submissions and preloads them for reflection.',
    oidc_initiation_url: `${toolUrl}/api/lti/login`,
    target_link_uri: `${toolUrl}/api/lti/launch`,
    public_jwk_url: `${toolUrl}/api/lti/jwks`,
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
              target_link_uri: `${toolUrl}/api/lti/launch`,
              text: 'Growth Portfolio',
            },
            {
              // Link selection for course navigation
              placement: 'link_selection',
              message_type: 'LtiDeepLinkingRequest',
              accept_types: ['ltiResourceLink'],
              target_link_uri: `${toolUrl}/api/lti/launch`,
            },
            {
              // Course navigation menu item (direct resource link)
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
