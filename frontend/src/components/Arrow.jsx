import React from 'react';
import './Arrow.css';

const Arrow = ({ from, to, color = '#ff6b6b', thickness = 6, opacity = 0.6, boardSize = 400 }) => {
  // Color mapping for SVG filters (like we do with pieces)
  const getColorFilter = (color) => {
    const colorMap = {
      '#ff6b6b': 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // red
      '#4dabf7': 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // blue
      '#51cf66': 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // green
      '#ffd43b': 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // yellow
      '#9775fa': 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // purple
    };
    return colorMap[color] || 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)';
  };
  // Convert square notation to coordinates
  const squareToCoords = (square) => {
    const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
    const rank = 8 - parseInt(square[1]); // 8=0, 7=1, etc.
    return { x: file, y: rank };
  };

  const fromCoords = squareToCoords(from);
  const toCoords = squareToCoords(to);

  // Calculate arrow properties (responsive to board size)
  const squareSize = boardSize / 8; // Size of each square
  const fromX = fromCoords.x * squareSize + squareSize / 2; // Center of square
  const fromY = fromCoords.y * squareSize + squareSize / 2;
  const toX = toCoords.x * squareSize + squareSize / 2;
  const toY = toCoords.y * squareSize + squareSize / 2;

      // Calculate arrow direction and length
      const deltaX = toX - fromX;
      const deltaY = toY - fromY;
      const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Calculate perpendicular offset for parallel lines
      const lineThickness = thickness * (boardSize / 400);
      const offset = lineThickness * 7; // Bigger gap between lines
      
      // Perpendicular direction (90 degrees rotated)
      const perpX = -deltaY / length * offset;
      const perpY = deltaX / length * offset;
  
      // Calculate arrow direction
      const angle = Math.atan2(deltaY, deltaX);
      
      // Ensure angle is valid (not NaN or Infinity)
      const validAngle = (isNaN(angle) || !isFinite(angle)) ? 0 : angle;
      
      // Convert to degrees and ensure it's a valid number
      const angleDegrees = validAngle * 180 / Math.PI;
      const finalAngle = isNaN(angleDegrees) || !isFinite(angleDegrees) ? 0 : Math.round(angleDegrees * 100) / 100; // Round to 2 decimal places
      
      // Test with a fixed angle first
      const testAngle = 45; // Fixed 45 degrees for testing
      
      // Build transform string step by step
      const translateStr = `translate(${toX}%, ${toY}%)`;
      const rotateStr = `rotate(${finalAngle}deg)`;
      const transformStr = `${translateStr} ${rotateStr}`;
      
      // Debug logging
      console.log('Arrow debug - fromX:', fromX);
      console.log('Arrow debug - fromY:', fromY);
      console.log('Arrow debug - toX:', toX);
      console.log('Arrow debug - toY:', toY);
      console.log('Arrow debug - finalAngle:', finalAngle);
      console.log('Arrow debug - transformStr:', transformStr);
      console.log('Arrow debug - transformStr length:', transformStr.length);

  return (
    <g className="arrow" key={`arrow-${from}-${to}`}>
      {/* Filled area between the lines using polygon */}
      <polygon
        points={`${fromX - perpX},${fromY - perpY} ${toX - perpX},${toY - perpY} ${toX + perpX},${toY + perpY} ${fromX + perpX},${fromY + perpY}`}
        fill={color}
        opacity={opacity * 0.4} // Lighter fill
      />
      
      {/* Two parallel lines with gap */}
      <line
        x1={fromX - perpX}
        y1={fromY - perpY}
        x2={toX - perpX}
        y2={toY - perpY}
        stroke={color}
        strokeWidth={lineThickness / 4} // Thinner lines since we have fill
        opacity={opacity}
        strokeLinecap="square"
      />
      <line
        x1={fromX + perpX}
        y1={fromY + perpY}
        x2={toX + perpX}
        y2={toY + perpY}
        stroke={color}
        strokeWidth={lineThickness / 4} // Thinner lines since we have fill
        opacity={opacity}
        strokeLinecap="square"
      />
      
      {/* Pentagon arrow head */}
      {/* <g
        transform="translate(${toX}, ${toY})"
        opacity={0.5}
      ></g> */}
       <g opacity={0.1}>
         <image
           href="/signs/pentagon.svg"
           x={toX - (squareSize * 1) / 2} // Center the pentagon
           y={toY - (squareSize * 1) / 2}
           width={squareSize * 1} // Scale with board size
           height={squareSize * 1}
           style={{ filter: `brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%)` }}
          
         />
       </g>
    </g>
  );
};

export default Arrow;
