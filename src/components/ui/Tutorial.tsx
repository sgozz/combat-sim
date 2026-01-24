import { useState } from 'react'
import type { RulesetId } from '../../../shared/types'
import { getRulesetComponents } from '../rulesets'

type TutorialProps = {
  onClose: () => void
  rulesetId?: RulesetId
}

export const Tutorial = ({ onClose, rulesetId = 'gurps' }: TutorialProps) => {
  const { tutorialSteps: STEPS } = getRulesetComponents(rulesetId)
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-content">
        <div className="tutorial-header">
          <h2>{STEPS[currentStep].title}</h2>
          <button className="tutorial-close" onClick={onClose}>×</button>
        </div>
        
        <div className="tutorial-body">
          <p>{STEPS[currentStep].description}</p>
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-dots">
            {STEPS.map((_, index) => (
              <span 
                key={index} 
                className={`tutorial-dot ${index === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>

          <div className="tutorial-nav">
            <button 
              className="tutorial-btn secondary" 
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              Previous
            </button>
            <button 
              className="tutorial-btn primary" 
              onClick={handleNext}
            >
              {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        
        <button className="tutorial-skip" onClick={onClose}>
          Skip Tutorial
        </button>
      </div>
    </div>
  )
}
