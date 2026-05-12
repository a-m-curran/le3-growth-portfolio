import { ReflectView } from './ReflectView'

/**
 * v2 Reflect — work-tied reflections.
 *
 * Sections:
 *   - In progress: resume cards linking back to the v1 conversation
 *     flow at /conversation/[id]
 *   - Featured work: submissions awaiting reflection, click → v1
 *     /reflect?work=<id> to start the conversation
 *   - Completed: past work reflections, click → ConversationPanel
 *     slide-out with full content
 *
 * Open standalone reflections live at /v2/journal, not here.
 */
export default function V2ReflectPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reflect</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reflect on submitted student work.
        </p>
      </div>
      <ReflectView />
    </div>
  )
}
