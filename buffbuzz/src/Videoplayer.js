import React, { useRef, useState, useEffect } from 'react';
import './Videoplayer.css';

export default function VideoPlayer({ videoUrl, captionUrl, poster }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef(null);

  // Auto-hide controls during playback
  useEffect(() => {
    if (isPlaying) {
      resetHideTimer();
    } else {
      clearTimeout(hideControlsTimer.current);
      setShowControls(true);
    }
    return () => clearTimeout(hideControlsTimer.current);
  }, [isPlaying]);

  const resetHideTimer = () => {
    clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const handleMouseMove = () => {
    if (isPlaying) resetHideTimer();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleEnded = () => setIsPlaying(false);

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    videoRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (e) => {
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    videoRef.current.volume = value;
    setVolume(value);
    setIsMuted(value === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Toggle the <track> element's mode between 'showing' and 'hidden'
  const toggleCaptions = () => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    if (tracks.length === 0) return;
    const track = tracks[0];
    const next = !captionsOn;
    track.mode = next ? 'showing' : 'hidden';
    setCaptionsOn(next);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`video-player-wrapper ${showControls ? 'controls-visible' : 'controls-hidden'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* The video element */}
      <video
        ref={videoRef}
        className="video-player-element"
        src={videoUrl}
        poster={poster}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        playsInline
        aria-label="Post video"
        crossOrigin="anonymous"
      >
        {/* Closed caption track — starts hidden; toggled via button */}
        {captionUrl && (
          <track
            kind="subtitles"
            src={captionUrl}
            srcLang="en"
            label="English"
            default={false}
          />
        )}
        Your browser does not support the video tag.
      </video>

      {/* Big play/pause overlay button */}
      {!isPlaying && (
        <button
          className="video-play-overlay"
          onClick={togglePlay}
          aria-label="Play video"
        >
          ▶
        </button>
      )}

      {/* Controls bar */}
      <div className="video-controls" role="group" aria-label="Video controls">
        {/* Seek bar */}
        <input
          type="range"
          className="video-seek"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek video"
        />

        <div className="video-controls-row">
          {/* Play / Pause */}
          <button
            className="video-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Time display */}
          <span className="video-time" aria-live="off">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Volume */}
          <button
            className="video-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted}
          >
            {isMuted ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            className="video-volume"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
          />

          {/* Captions toggle — only shown when a caption file exists */}
          {captionUrl && (
            <button
              className={`video-btn video-cc-btn ${captionsOn ? 'cc-active' : ''}`}
              onClick={toggleCaptions}
              aria-label={captionsOn ? 'Turn off captions' : 'Turn on captions'}
              aria-pressed={captionsOn}
              title="Toggle captions"
            >
              CC
            </button>
          )}

          {/* Fullscreen */}
          <button
            className="video-btn video-btn-right"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>
      </div>
    </div>
  );
}