import { useState } from 'react';
import type { HitLocation } from '../../../shared/types';
import { HIT_LOCATION_DATA } from '../../../shared/rules';

interface HitLocationPickerProps {
  selectedLocation: HitLocation | null;
  onSelect: (location: HitLocation) => void;
  disabled?: boolean;
}

export default function HitLocationPicker({ selectedLocation, onSelect, disabled = false }: HitLocationPickerProps) {
  const [hoveredLocation, setHoveredLocation] = useState<HitLocation | null>(null);

  const handleMouseEnter = (loc: HitLocation) => {
    if (!disabled) setHoveredLocation(loc);
  };

  const handleMouseLeave = () => {
    setHoveredLocation(null);
  };

  const handleClick = (loc: HitLocation) => {
    if (!disabled) onSelect(loc);
  };

  const getPenalty = (loc: HitLocation) => HIT_LOCATION_DATA[loc]?.penalty ?? 0;
  
  const LocationPath = ({ 
    location, 
    d, 
    cx, 
    cy, 
    r, 
    width, 
    height, 
    x, 
    y,
    points
  }: { 
    location: HitLocation; 
    d?: string;
    cx?: number;
    cy?: number;
    r?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    points?: string;
  }) => {
    const isSelected = selectedLocation === location;
    const penalty = getPenalty(location);
    const label = `${penalty}`;

    let labelX = 0;
    let labelY = 0;

    if (cx !== undefined && cy !== undefined) {
      labelX = cx;
      labelY = cy;
    } else if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
      labelX = x + width / 2;
      labelY = y + height / 2;
    } else {
      // Manual offsets for label centering on irregular paths
      switch(location) {
        case 'skull': labelX = 100; labelY = 25; break;
        case 'face': labelX = 100; labelY = 55; break;
        case 'neck': labelX = 100; labelY = 78; break;
        case 'torso': labelX = 100; labelY = 130; break;
        case 'vitals': labelX = 100; labelY = 105; break;
        case 'groin': labelX = 100; labelY = 175; break;
        case 'arm_left': labelX = 55; labelY = 110; break;
        case 'arm_right': labelX = 145; labelY = 110; break;
        case 'hand_left': labelX = 30; labelY = 160; break;
        case 'hand_right': labelX = 170; labelY = 160; break;
        case 'leg_left': labelX = 70; labelY = 220; break;
        case 'leg_right': labelX = 130; labelY = 220; break;
        case 'foot_left': labelX = 65; labelY = 285; break;
        case 'foot_right': labelX = 135; labelY = 285; break;
        case 'eye': labelX = 100; labelY = 40; break;
        default: labelX = 0; labelY = 0;
      }
    }

    const showText = location !== 'eye'; 

    return (
      <g 
        onClick={() => handleClick(location)}
        onMouseEnter={() => handleMouseEnter(location)}
        onMouseLeave={handleMouseLeave}
        className="hit-location-group"
      >
        {d && <path d={d} className={`hit-location-part ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`} />}
        {cx !== undefined && <circle cx={cx} cy={cy} r={r} className={`hit-location-part ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`} />}
        {width !== undefined && <rect x={x} y={y} width={width} height={height} rx="4" className={`hit-location-part ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`} />}
        {points !== undefined && <polygon points={points} className={`hit-location-part ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`} />}
        
        {showText && (
          <g className="hit-location-label-group">
            <text x={labelX} y={labelY} className="hit-location-penalty">{label}</text>
          </g>
        )}
      </g>
    );
  };

  const activePenalty = hoveredLocation ? getPenalty(hoveredLocation) : (selectedLocation ? getPenalty(selectedLocation) : null);
  const activeName = hoveredLocation 
    ? hoveredLocation.replace('_', ' ').toUpperCase() 
    : (selectedLocation ? selectedLocation.replace('_', ' ').toUpperCase() : 'SELECT TARGET');

  return (
    <div className="hit-location-picker">
      <div className="hit-location-header">
        {activeName} {activePenalty !== null ? `(${activePenalty})` : ''}
      </div>
      
      <svg viewBox="0 0 200 310" className="hit-location-svg">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <LocationPath location="skull" d="M 75 40 A 25 25 0 1 1 125 40 L 125 50 L 75 50 Z" />
        
        <LocationPath location="face" d="M 75 50 L 125 50 L 120 70 L 80 70 Z" />
        
        <g onClick={() => handleClick('eye')} onMouseEnter={() => handleMouseEnter('eye')} onMouseLeave={handleMouseLeave}>
           <circle cx={90} cy={45} r={4} className={`hit-location-part ${selectedLocation === 'eye' ? 'selected' : ''}`} />
           <circle cx={110} cy={45} r={4} className={`hit-location-part ${selectedLocation === 'eye' ? 'selected' : ''}`} />
        </g>

        <LocationPath location="neck" x={85} y={70} width={30} height={15} />

        <LocationPath location="arm_left" d="M 75 85 L 40 95 L 30 140 L 50 145 L 75 110 Z" />
        
        <LocationPath location="arm_right" d="M 125 85 L 160 95 L 170 140 L 150 145 L 125 110 Z" />

        <LocationPath location="hand_left" cx={40} cy={160} r={12} />
        <LocationPath location="hand_right" cx={160} cy={160} r={12} />

        <LocationPath location="torso" d="M 75 85 L 125 85 L 120 160 L 80 160 Z" />
        
        <LocationPath location="vitals" cx={100} cy={105} r={10} />
        
        <LocationPath location="groin" points="80,160 120,160 100,190" />

        <LocationPath location="leg_left" d="M 90 180 L 70 190 L 60 260 L 85 260 Z" />
        <LocationPath location="leg_right" d="M 110 180 L 130 190 L 140 260 L 115 260 Z" />

        <LocationPath location="foot_left" d="M 60 260 L 85 260 L 85 270 L 55 285 L 55 270 Z" />
        <LocationPath location="foot_right" d="M 140 260 L 115 260 L 115 270 L 145 285 L 145 270 Z" />

      </svg>
      
      <div className="hit-location-tooltip">
        {hoveredLocation && (
          <span>Hit Penalty: {getPenalty(hoveredLocation)}</span>
        )}
      </div>
    </div>
  );
}
