import React, { useState } from 'react';
import { getPieceImage, getPieceSymbol, getPieceName } from './PieceIcons';
import './Piece.css';

const Piece = ({ 
  piece, 
  square, 
  size = '100%',
  className = '',
  onClick = null,
  isDragging = false,
  isSelected = false,
  useImages = true
}) => {
  const [imageError, setImageError] = useState(false);
  
  if (!piece) return null;

  const pieceImage = getPieceImage(piece);
  const pieceSymbol = getPieceSymbol(piece);
  const pieceName = getPieceName(piece);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e, piece, square);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <span
      className={`piece ${className} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      style={{ fontSize: size }}
      onClick={handleClick}
      role="img"
      aria-label={pieceName}
      title={pieceName}
    >
      {useImages && pieceImage && !imageError ? (
        <img
          src={pieceImage}
          alt={pieceName}
          className="piece-image"
          onError={handleImageError}
          draggable={false}
        />
      ) : (
        <span className="piece-symbol">{pieceSymbol}</span>
      )}
    </span>
  );
};

export default Piece;
