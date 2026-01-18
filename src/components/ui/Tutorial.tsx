import { useState } from 'react'

type TutorialProps = {
  onClose: () => void
}

const STEPS = [
  {
    title: "Welcome to Tactical Combat!",
    description: "This simulator lets you experience tactical turn-based combat. You'll control a character on a hex grid, managing movement, attacks, and defenses.",
  },
  {
    title: "Choose Your Maneuver",
    description: "At the start of your turn, you must choose a maneuver (e.g., Move, Attack, All-Out Defense). This determines what you can do during your turn.",
  },
  {
    title: "Movement & Attacks",
    description: "Click on the hex grid to move your character. To attack, select an enemy within range and choose your attack type. Facing and distance matter!",
  },
  {
    title: "Combat Resolution",
    description: "Attacks are resolved by rolling 3d6 against your skill. If you hit, the defender rolls for active defense (Dodge, Parry, or Block). Damage is applied if the defense fails.",
  },
  {
    title: "Victory!",
    description: "The goal is to defeat your opponents by reducing their HP to 0 or below. Watch your fatigue and keep an eye on the initiative tracker!",
  }
]

export const Tutorial = ({ onClose }: TutorialProps) => {
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
