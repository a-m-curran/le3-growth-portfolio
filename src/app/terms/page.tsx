export const metadata = {
  title: 'Terms of Service — LE3 Growth Portfolio',
}

/**
 * Terms of service linked from Brightspace's LTI tool registration.
 * Intentionally short and plain-language. Subject to revision with NLU counsel.
 */
export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10 text-gray-800">
      <h1 className="text-2xl font-bold text-green-900 mb-2">Terms of Use</h1>
      <p className="text-xs text-gray-500 mb-8">
        LE3 Growth Portfolio &middot; Pilot v1 &middot; Last updated April 2026
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Who this is for</h2>
      <p className="text-sm mb-4">
        The LE3 Growth Portfolio is a reflection and growth tool for students
        enrolled in National Louis University&rsquo;s LE3 program. It is not a
        general-purpose product and is not available for use outside that
        program.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">How you use it</h2>
      <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
        <li>Use it to reflect on your own academic work, set personal goals, and track your own growth</li>
        <li>Write honestly in your reflections and conversations</li>
        <li>Don&rsquo;t share your login with anyone else</li>
        <li>Don&rsquo;t upload content that isn&rsquo;t yours or that violates NLU&rsquo;s student conduct policies</li>
      </ul>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">How the AI works</h2>
      <p className="text-sm mb-4">
        The portfolio uses AI language models to ask reflective questions,
        generate narratives about your growth, and create career-facing
        summaries of your skills. The AI is a tool, not an authority &mdash; it can
        make mistakes, miss context, or mischaracterize your work. Treat AI
        suggestions as starting points for your own thinking and revise
        anything that doesn&rsquo;t feel right. Your coach is always available
        to help you interpret AI output.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Your content is yours</h2>
      <p className="text-sm mb-4">
        You own everything you write in the portfolio. NLU and the LE3 program
        use your content only to support your learning and to help you build
        skill narratives you can use after the program ends. You can request a
        copy of your content, or ask for it to be deleted, at any time.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Coaching relationship</h2>
      <p className="text-sm mb-4">
        Your LE3 coach can see your submitted work, your reflections, your
        skill definitions, and your goals. Coaches use this to support you, not
        to grade you &mdash; the portfolio does not produce grades and is separate
        from your academic transcript.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Changes</h2>
      <p className="text-sm mb-4">
        We may update these terms as the program evolves. Material changes will
        be communicated through the portfolio and/or your coach.
      </p>

      <h2 className="text-lg font-semibold text-green-900 mt-8 mb-2">Privacy</h2>
      <p className="text-sm mb-4">
        See the{' '}
        <a href="/privacy" className="text-green-700 underline">
          Privacy Notice
        </a>{' '}
        for details on what we collect and how we use it.
      </p>

      <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-500">
        These terms are a draft for the LE3 pilot. They will be revised in
        consultation with NLU&rsquo;s Office of the General Counsel before full
        program rollout.
      </div>
    </main>
  )
}
