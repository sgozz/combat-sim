import React, { useState, useRef, useEffect } from 'react'

type TooltipProps = {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export const Tooltip = ({ 
  content, 
  children, 
  position = 'top', 
  delay = 300 
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div 
      className="tooltip-wrapper" 
      onMouseEnter={showTooltip} 
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div className={`tooltip-content tooltip-${position}`}>
          {content}
          <div className="tooltip-arrow" />
        </div>
      )}
    </div>
  )
}
