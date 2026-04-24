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

  // Single image: just use alt. Multiple: "alt, image 2 of 5"
  const imageAlt = images.length === 1
    ? alt
    : `${alt}, image ${currentIndex + 1} of ${images.length}`;

  return (
    <div
      className={`image-carousel ${className}`}
      role="region"
      aria-label={images.length > 1 ? `Image carousel: ${alt}` : alt}
      aria-roledescription="carousel"
    >
      {/* aria-live so screen readers announce the new image on slide change */}
      <div
        className="carousel-inner"
        aria-live="polite"
        aria-atomic="true"
      >
        <img
          src={images[currentIndex]}
          alt={imageAlt}
          className="carousel-image"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-btn carousel-prev"
              onClick={goPrev}
              aria-label={`Previous image (${currentIndex === 0 ? images.length : currentIndex} of ${images.length})`}
            >
              ‹
            </button>
            <button
              type="button"
              className="carousel-btn carousel-next"
              onClick={goNext}
              aria-label={`Next image (${currentIndex === images.length - 1 ? 1 : currentIndex + 2} of ${images.length})`}
            >
              ›
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="carousel-dots" role="tablist" aria-label="Image slides">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              className={`carousel-dot ${i === currentIndex ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
              aria-label={`Go to image ${i + 1} of ${images.length}`}
              aria-selected={i === currentIndex}
              aria-current={i === currentIndex ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}