'use client'

import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number | undefined
  digits?: number
  className?: string
  /** Rendered when the API has not supplied a value. */
  fallback?: string
}

export function AnimatedNumber({ value, digits = 2, className, fallback = '—' }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(value ?? 0)
  const previous = useRef(0)

  useEffect(() => {
    if (value === undefined || !Number.isFinite(value)) return
    if (reduceMotion) {
      previous.current = value
      setDisplay(value)
      return
    }
    const controls = animate(previous.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        previous.current = value
      },
    })
    return () => controls.stop()
  }, [value, reduceMotion])

  if (value === undefined || !Number.isFinite(value)) {
    return <span className={className}>{fallback}</span>
  }

  return (
    <span className={className} suppressHydrationWarning>
      {display.toFixed(digits)}
    </span>
  )
}
