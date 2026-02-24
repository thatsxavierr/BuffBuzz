import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import './ImageCropModal.css';

export default function ImageCropModal({ image, onClose, onCropComplete }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onCropCompleteCallback = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    // Set canvas size to match the cropped area
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Convert canvas to base64 data URL for backend compatibility
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) {
      onClose();
      return;
    }

    try {
      const croppedImageUrl = await getCroppedImg(image, croppedAreaPixels);
      if (croppedImageUrl) {
        onCropComplete(croppedImageUrl);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Error cropping image. Please try again.');
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="crop-modal-overlay" onClick={handleCancel}>
      <div className="crop-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="crop-modal-header">
          <h2>Adjust Profile Picture</h2>
          <p>Drag to reposition, use the slider to zoom</p>
        </div>
        
        <div className="crop-container">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="round"
            showGrid={false}
          />
        </div>

        <div className="crop-controls">
          <label htmlFor="zoom-slider" className="zoom-label">
            Zoom
          </label>
          <input
            id="zoom-slider"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="zoom-slider"
          />
          <span className="zoom-value">{zoom.toFixed(1)}x</span>
        </div>

        <div className="crop-modal-actions">
          <button type="button" className="crop-cancel-button" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="crop-save-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
