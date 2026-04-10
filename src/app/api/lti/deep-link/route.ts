import { NextRequest, NextResponse } from 'next/server'
import { verifyPlatformJwt, signDeepLinkingResponse } from '@/lib/lti/jwt'
import { createAdminClient } from '@/lib/supabase-admin'
import { LTI_CLAIMS } from '@/lib/lti/claims'
import { getToolConfig } from '@/lib/lti/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/lti/deep-link
 *
 * Instructor has filled out the deep linking form in /lti/deep-link.
 * We:
 * 1. Pull the deep linking request JWT from the cookie set by /api/lti/launch
 * 2. Store the assignment content in the lti_resource table
 * 3. Sign a deep linking response JWT
 * 4. Return an HTML form that auto-POSTs the response JWT to the platform's
 *    deep_link_return_url
 */
export async function POST(req: NextRequest) {
  try {
    const { title, body, resourceLinkId } = (await req.json()) as {
      title: string
      body: string
      resourceLinkId?: string
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const requestJwt = req.cookies.get('lti_deep_link_jwt')?.value
    if (!requestJwt) {
      return NextResponse.json(
        { error: 'No deep linking request in session' },
        { status: 400 }
      )
    }

    // Re-verify the original request JWT
    const payload = await verifyPlatformJwt(requestJwt)

    const deepLinkSettings = payload[LTI_CLAIMS.DEEP_LINKING_SETTINGS]
    const deploymentId = payload[LTI_CLAIMS.DEPLOYMENT_ID]
    const context = payload[LTI_CLAIMS.CONTEXT]

    if (!deepLinkSettings || !deploymentId) {
      return NextResponse.json(
        { error: 'Deep linking settings missing from original request' },
        { status: 400 }
      )
    }

    // Store assignment content in lti_resource
    const admin = createAdminClient()
    const generatedResourceLinkId = resourceLinkId || crypto.randomUUID()

    await admin
      .from('lti_resource')
      .upsert(
        {
          platform_issuer: payload.iss,
          resource_link_id: generatedResourceLinkId,
          deployment_id: deploymentId,
          context_id: context?.id || 'unknown',
          context_title: context?.title || null,
          assignment_title: title,
          assignment_body: body || null,
        },
        { onConflict: 'platform_issuer,resource_link_id' }
      )

    // Build ContentItem based on what the platform is willing to accept.
    // For Asset Processor attachments (accept_types includes ltiAssetProcessor),
    // we return an asset processor content item. Otherwise we fall back to
    // a resource link for course navigation placement.
    const { toolUrl } = getToolConfig()
    const acceptTypes = deepLinkSettings.accept_types || []
    const isAssetProcessor = acceptTypes.includes('ltiAssetProcessor')

    const contentItems = isAssetProcessor
      ? [
          {
            type: 'ltiAssetProcessor',
            title: title || 'LE3 Growth Portfolio',
            text: 'Students reflect on this submission through an AI-guided conversation. The portfolio surfaces skill insights from their reflection.',
            icon: {
              url: `${toolUrl}/favicon.ico`,
              width: 48,
              height: 48,
            },
            custom: {
              resource_link_id: generatedResourceLinkId,
              instructor_title: title,
              ...(body ? { instructor_body: body.substring(0, 2000) } : {}),
            },
          },
        ]
      : [
          {
            type: 'ltiResourceLink',
            title,
            text: body ? body.substring(0, 200) : undefined,
            url: `${toolUrl}/api/lti/launch`,
            custom: {
              resource_link_id: generatedResourceLinkId,
            },
          },
        ]

    // Sign response JWT
    const responseJwt = await signDeepLinkingResponse(
      deploymentId,
      contentItems,
      deepLinkSettings.data
    )

    // Return auto-submitting form HTML that posts back to the platform
    const html = `<!DOCTYPE html>
<html>
<head><title>Completing LTI Deep Link</title></head>
<body>
<form id="f" method="POST" action="${deepLinkSettings.deep_link_return_url}">
<input type="hidden" name="JWT" value="${responseJwt}" />
</form>
<script>document.getElementById('f').submit();</script>
<p>Returning to your course...</p>
</body>
</html>`

    const response = new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
    response.cookies.delete('lti_deep_link_jwt')
    return response
  } catch (error) {
    console.error('LTI deep-link error:', error)
    return NextResponse.json(
      { error: 'Deep link submission failed: ' + String(error) },
      { status: 500 }
    )
  }
}
