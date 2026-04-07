'use client'

import { useState, useCallback } from 'react'

/**
 * Hook for "on rails" demo animations.
 * Simulates a loading state before revealing pre-generated content.
 */
export function useDemoReveal(delay = 2000) {
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)

  const trigger = useCallback(() => {
    if (loading || revealed) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setRevealed(true)
    }, delay)
  }, [delay, loading, revealed])

  const reset = useCallback(() => {
    setRevealed(false)
    setLoading(false)
  }, [])

  return { revealed, loading, trigger, reset }
}
