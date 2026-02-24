import React, { useState } from 'react';
import './ImageCarousel.css';

export default function ImageCarousel({ images = [], alt = 'Item', className = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const goPrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  };

  const goNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
  };

  return (
    <div className={`image-carousel ${className}`}>
      <div className="carousel-inner">
        <img
          src={images[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="carousel-image"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-btn carousel-prev"
              onClick={goPrev}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              className="carousel-btn carousel-next"
              onClick={goNext}
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="carousel-dots">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`carousel-dot ${i === currentIndex ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
