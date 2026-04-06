'use client'

import { useState } from 'react'

interface NoteCaptureProps {
  studentName: string
}

export function NoteCapture({ studentName }: NoteCaptureProps) {
  const [note, setNote] = useState('')
  const [brightSpot, setBrightSpot] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // Demo: just show saved state
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Note</h3>

      <div className="space-y-3">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={`Session notes for ${studentName}...`}
          className="w-full min-h-[80px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Bright spot</label>
            <input
              type="text"
              value={brightSpot}
              onChange={e => setBrightSpot(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Next step</label>
            <input
              type="text"
              value={nextStep}
              onChange={e => setNextStep(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!note.trim()}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {saved ? '✓ Saved' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
