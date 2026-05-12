'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDownIcon } from './icons'

/**
 * Coach-only "selected student" dropdown in the sidebar.
 *
 * Maintains a "currently viewing" student that persists across coach
 * routes via the `student` URL query parameter. Clicking a name
 * pushes ?student=<id> onto the current path. If the coach is on a
 * student-detail route (/v2/coach/[studentId]), the dropdown
 * navigates there with the new id instead of just swapping a query.
 *
 * Phase 0 deliberately stubs the student list — Phase 1 will wire
 * this to /api/coach/students. Until then, the dropdown opens and
 * the empty state surfaces.
 */

interface StudentOption {
  id: string
  firstName: string
  lastName: string
}

export function StudentPicker() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // Selected student can come from either:
  //   - The path /v2/coach/[id] (when viewing student detail)
  //   - A ?student=<id> query param (when on other coach routes)
  // Path always wins because it's the canonical "currently viewing"
  // location.
  const pathMatch = pathname.match(/^\/v2\/coach\/([^/?]+)$/)
  const pathId =
    pathMatch &&
    !['caseload', 'tools'].includes(pathMatch[1])
      ? pathMatch[1]
      : null
  const selectedId = pathId || params.get('student')

  const [open, setOpen] = useState(false)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Fetch caseload lazily on first open. Phase 1 may hoist this to
  // the layout so the picker pre-populates.
  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    fetch('/api/coach/students', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { students?: StudentOption[] }) => {
        if (cancelled) return
        setStudents(j.students ?? [])
        setLoaded(true)
      })
      .catch(() => {
        // Endpoint may not exist yet. Treat as empty rather than
        // surfacing an error — the picker is non-critical scaffolding.
        if (cancelled) return
        setStudents([])
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, loaded])

  const selectedName = selectedId
    ? students.find(s => s.id === selectedId)
    : null

  const choose = (id: string) => {
    setOpen(false)
    // If we're on a student-detail route, swap the id segment;
    // otherwise just append/replace the query param so the selection
    // travels with the coach across other routes.
    const onStudentRoute = /^\/v2\/coach\/[^/?]+/.test(pathname)
    if (onStudentRoute) {
      router.push(`/v2/coach/${id}`)
    } else {
      const url = new URL(window.location.href)
      url.searchParams.set('student', id)
      router.push(url.pathname + url.search)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 text-left text-sm transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Viewing
          </div>
          <div className="text-sm truncate text-gray-900 font-medium">
            {selectedName
              ? `${selectedName.firstName} ${selectedName.lastName}`
              : 'No student selected'}
          </div>
        </div>
        <ChevronDownIcon className="w-4 h-4 text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-lg bg-white border border-gray-200 shadow-lg py-1">
          {!loaded ? (
            <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
          ) : students.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500 italic">
              No students in your caseload yet. They&rsquo;ll appear here
              after the next sync or LTI launch.
            </div>
          ) : (
            students.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(s.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  s.id === selectedId ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-800'
                }`}
              >
                {s.firstName} {s.lastName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
