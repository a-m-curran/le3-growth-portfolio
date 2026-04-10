/**
 * LTI 1.3 JWT claim types
 * Spec: https://www.imsglobal.org/spec/lti/v1p3
 */

export const LTI_CLAIMS = {
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  TARGET_LINK_URI: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  ROLES: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  CUSTOM: 'https://purl.imsglobal.org/spec/lti/claim/custom',
  LIS: 'https://purl.imsglobal.org/spec/lti/claim/lis',
  TOOL_PLATFORM: 'https://purl.imsglobal.org/spec/lti/claim/tool_platform',
  LAUNCH_PRESENTATION: 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation',
  AGS_ENDPOINT: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  NRPS_NAMESROLES: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
  DEEP_LINKING_SETTINGS: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  DEEP_LINKING_CONTENT_ITEMS: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  DEEP_LINKING_DATA: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',

  // Platform Notification Service
  PNS_ENDPOINT: 'https://purl.imsglobal.org/spec/lti/claim/platformnotificationservice',
  NOTICE: 'https://purl.imsglobal.org/spec/lti/claim/notice',

  // Asset Processor
  FOR_USER: 'https://purl.imsglobal.org/spec/lti/claim/for_user',
  ACTIVITY: 'https://purl.imsglobal.org/spec/lti/claim/activity',
  SUBMISSION: 'https://purl.imsglobal.org/spec/lti/claim/submission',
  ASSET_SERVICE: 'https://purl.imsglobal.org/spec/lti/claim/assetservice',
  ASSET_REPORT: 'https://purl.imsglobal.org/spec/lti/claim/assetreport',
  EULA_SERVICE: 'https://purl.imsglobal.org/spec/lti/claim/eulaservice',
  ASSETREPORT_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/assetreport_type',
  ASSET: 'https://purl.imsglobal.org/spec/lti/claim/asset',
} as const

export type LtiMessageType =
  | 'LtiResourceLinkRequest'
  | 'LtiDeepLinkingRequest'
  | 'LtiAssetProcessorSettingsRequest'
  | 'LtiReportReviewRequest'
  | 'LtiEulaRequest'

export type LtiNoticeType =
  | 'LtiAssetProcessorSubmissionNotice'
  | 'LtiHelloWorldNotice'
  | 'LtiContextCopyNotice'

export const ROLES = {
  STUDENT: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
  INSTRUCTOR: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
  ADMIN: 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
} as const

export interface LtiResourceLinkClaim {
  id: string
  title?: string
  description?: string
}

export interface LtiContextClaim {
  id: string
  label?: string
  title?: string
  type?: string[]
}

export interface LtiAgsEndpointClaim {
  scope: string[]
  lineitems?: string
  lineitem?: string
}

export interface LtiDeepLinkingSettingsClaim {
  deep_link_return_url: string
  accept_types: string[]
  accept_presentation_document_targets: string[]
  accept_media_types?: string
  accept_multiple?: boolean
  auto_create?: boolean
  title?: string
  text?: string
  data?: string
}

// ─── Platform Notification Service ──────────────────

export interface LtiPnsEndpointClaim {
  platform_notification_service_url: string
  scope: string[]
  notice_types_supported: string[]
}

export interface LtiNoticeClaim {
  id: string
  timestamp: string
  type: LtiNoticeType
}

// ─── Asset Processor ────────────────────────────────

export interface LtiForUserClaim {
  user_id: string
  person_sourcedid?: string
  name?: string
  given_name?: string
  family_name?: string
  email?: string
}

export interface LtiActivityClaim {
  id: string
  title?: string
  description?: string
}

export interface LtiSubmissionClaim {
  id: string
  started_at?: string
  submitted_at?: string
  attempt?: number
}

export interface LtiAsset {
  asset_id: string
  url: string
  sha256_checksum?: string
  timestamp?: string
  size?: number
  content_type?: string
  title?: string
  filename?: string
}

export interface LtiAssetServiceClaim {
  scope: string[]
  assets: LtiAsset[]
}

export interface LtiAssetReportClaim {
  scope: string[]
  report_url: string
}

export interface LtiJwtPayload {
  iss: string
  aud: string | string[]
  sub: string
  exp: number
  iat: number
  nonce: string
  azp?: string

  // Identity
  email?: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string

  // LTI claims (indexed by full URI)
  [LTI_CLAIMS.MESSAGE_TYPE]?: LtiMessageType
  [LTI_CLAIMS.VERSION]?: string
  [LTI_CLAIMS.DEPLOYMENT_ID]?: string
  [LTI_CLAIMS.TARGET_LINK_URI]?: string
  [LTI_CLAIMS.RESOURCE_LINK]?: LtiResourceLinkClaim
  [LTI_CLAIMS.CONTEXT]?: LtiContextClaim
  [LTI_CLAIMS.ROLES]?: string[]
  [LTI_CLAIMS.AGS_ENDPOINT]?: LtiAgsEndpointClaim
  [LTI_CLAIMS.DEEP_LINKING_SETTINGS]?: LtiDeepLinkingSettingsClaim
  [LTI_CLAIMS.CUSTOM]?: Record<string, string>

  // PNS + Asset Processor claims
  [LTI_CLAIMS.PNS_ENDPOINT]?: LtiPnsEndpointClaim
  [LTI_CLAIMS.NOTICE]?: LtiNoticeClaim
  [LTI_CLAIMS.FOR_USER]?: LtiForUserClaim
  [LTI_CLAIMS.ACTIVITY]?: LtiActivityClaim
  [LTI_CLAIMS.SUBMISSION]?: LtiSubmissionClaim
  [LTI_CLAIMS.ASSET_SERVICE]?: LtiAssetServiceClaim
  [LTI_CLAIMS.ASSET_REPORT]?: LtiAssetReportClaim
}

export function isStudent(payload: LtiJwtPayload): boolean {
  const roles = payload[LTI_CLAIMS.ROLES] || []
  return roles.some(r => r === ROLES.STUDENT || r.toLowerCase().includes('learner'))
}

export function isInstructor(payload: LtiJwtPayload): boolean {
  const roles = payload[LTI_CLAIMS.ROLES] || []
  return roles.some(r =>
    r === ROLES.INSTRUCTOR ||
    r.toLowerCase().includes('instructor') ||
    r === ROLES.ADMIN ||
    r.toLowerCase().includes('administrator')
  )
}

export function getMessageType(payload: LtiJwtPayload): LtiMessageType | undefined {
  return payload[LTI_CLAIMS.MESSAGE_TYPE]
}

export function getNoticeType(payload: LtiJwtPayload): LtiNoticeType | undefined {
  return payload[LTI_CLAIMS.NOTICE]?.type
}

export function isAssetProcessorSubmissionNotice(payload: LtiJwtPayload): boolean {
  return getNoticeType(payload) === 'LtiAssetProcessorSubmissionNotice'
}
