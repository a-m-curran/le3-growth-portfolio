export const metadata = {
  title: 'Privacy Notice — LE3 Growth Portfolio',
}

export const dynamic = 'force-dynamic'

/**
 * Student-facing privacy notice linked from Brightspace's LTI tool
 * registration. Intentionally short and plain-language. Subject to
 * revision with NLU counsel before full pilot launch.
 *
 * Named developer identity is read from LTI_DEVELOPER_NAME env var.
 * Contact email is read from LTI_VENDOR_CONTACT_EMAIL env var (shared
 * with the Brightspace registration form).
 */
export default function PrivacyPage() {
  const developerName = process.env.LTI_DEVELOPER_NAME || 'the LE3 Growth Portfolio developer'
  const contactEmail = process.env.LTI_VENDOR_CONTACT_EMAIL || 'contact@le3-growth-portfolio.vercel.app'

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 text-gray-800">
      <h1 className="text-2xl font-bold text-green-900 mb-2">Privacy Notice</h1>
      <p className="text-xs text-gray-500 mb-8">
        LE3 Growth Portfolio &middot; Pilot v1 &middot; Last updated April 2026
      </p>

      <p className="text-sm mb-6">
        The LE3 Growth Portfolio is a student reflection tool built for
        National Louis University&rsquo;s LE3 program by {developerName}. It
        will eventually be administered directly by NLU. This notice explains
        what information we collect, how we use it, and who can see it.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">What we collect</h2>
      <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
        <li>Your name and email address from your NLU Brightspace account</li>
        <li>A stable opaque identifier Brightspace provides us for your account</li>
        <li>Course names and assignment titles for work you submit to LE3 courses</li>
        <li>The text of assignments you submit to dropboxes that have the portfolio attached</li>
        <li>Your reflective conversations with the portfolio&rsquo;s AI</li>
        <li>Skill ratings and definitions you write, and your quarterly goals</li>
        <li>Notes your assigned coach writes about your sessions</li>
      </ul>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">What we don&rsquo;t collect</h2>
      <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
        <li>Your Brightspace password or any other credentials</li>
        <li>Your grades, GPA, or academic records</li>
        <li>Course rosters or information about other students</li>
        <li>Your location, IP address, or device fingerprint</li>
        <li>Anything from courses outside of LE3</li>
      </ul>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">How we use it</h2>
      <p className="text-sm mb-4">
        Your information is used solely to support reflective conversations in
        the LE3 program. We never sell data, use it for advertising, or share
        it with third parties outside the ones listed below. Your academic
        work and reflections are used to generate AI-assisted narratives and
        career summaries that only you and your coach can see.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Who can see your data</h2>
      <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
        <li><strong>You</strong> &mdash; always, through the portfolio interface</li>
        <li><strong>Your assigned LE3 coach</strong> &mdash; your submitted work, reflections, skill ratings, and definitions</li>
        <li><strong>LE3 program staff with administrative access</strong> &mdash; aggregate analytics only, unless investigating a specific issue</li>
        <li><strong>{developerName}</strong> &mdash; has technical/developer access to the running system to maintain it; does not access individual student records outside of support and debugging</li>
      </ul>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Third-party services we use</h2>
      <p className="text-sm mb-2">
        The portfolio runs on these services, which process data on our behalf
        under contractual agreements prohibiting other use:
      </p>
      <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
        <li><strong>Supabase</strong> &mdash; database and authentication (US-hosted, SOC 2 Type II)</li>
        <li><strong>Vercel</strong> &mdash; application hosting (US-hosted, SOC 2 Type II)</li>
        <li><strong>Anthropic (Claude API)</strong> &mdash; AI conversation generation. Does not train on API inputs.</li>
        <li><strong>Google (Gemini API)</strong> &mdash; alternate AI model (paid tier). Does not train on paid API inputs.</li>
      </ul>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">How long we keep it</h2>
      <p className="text-sm mb-4">
        Your data is retained as long as you are enrolled in the LE3 program.
        After you graduate or withdraw, records are retained according to
        NLU&rsquo;s educational records retention policy. You can request
        deletion at any time through your coach or by contacting the LE3
        program.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">FERPA</h2>
      <p className="text-sm mb-4">
        The Growth Portfolio handles educational records covered by the Family
        Educational Rights and Privacy Act (FERPA). We operate as a &ldquo;school
        official&rdquo; under NLU&rsquo;s direction, not as an independent
        party, and are bound by FERPA&rsquo;s use and disclosure rules.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Questions or requests about your data</h2>
      <p className="text-sm mb-4">
        For requests about your educational records (access, correction,
        deletion), contact the LE3 program at National Louis University
        directly &mdash; NLU is the institutional steward of this data under
        FERPA.
      </p>
      <p className="text-sm mb-4">
        For technical questions about how the portfolio works or issues with
        the application itself, you can reach {developerName} at{' '}
        <a href={`mailto:${contactEmail}`} className="text-green-700 underline">
          {contactEmail}
        </a>
        .
      </p>

      <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-500">
        This notice is a draft for the LE3 pilot. It will be revised in
        consultation with NLU&rsquo;s Office of the General Counsel before
        full program rollout.
      </div>
    </main>
  )
}
