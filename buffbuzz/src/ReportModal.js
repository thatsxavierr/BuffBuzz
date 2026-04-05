import React, { useState, useEffect } from 'react';
import './ReportModal.css';

const CATEGORIES = [
  { value: 'SPAM', label: 'Spam or misleading' },
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'OTHER', label: 'Other' },
];

export default function ReportModal({
  isOpen,
  onClose,
  reporterId,
  targetType,
  targetId,
  subjectLabel = 'this content',
}) {
  const [category, setCategory] = useState('OTHER');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCategory('OTHER');
      setDetails('');
      setSubmitting(false);
    }
  }, [isOpen, targetId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reporterId || !targetType || !targetId) return;
    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId,
          targetType,
          targetId,
          category,
          details: details.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.message || 'Report submitted.');
        onClose();
      } else {
        alert(data.message || 'Could not submit report.');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="report-modal-title"
      >
        <button type="button" className="report-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="report-modal-title">Report {subjectLabel}</h2>
        <p className="report-modal-hint">
          Moderators review reports. The person you report is not told who filed it.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="report-modal-label" htmlFor="report-category">
            Reason
          </label>
          <select
            id="report-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="report-modal-select"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="report-modal-label" htmlFor="report-details">
            Additional details (optional)
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="report-modal-textarea"
            rows={4}
            maxLength={2000}
            placeholder="Help moderators understand what happened…"
          />
          <div className="report-modal-actions">
            <button type="button" className="report-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="report-modal-submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
