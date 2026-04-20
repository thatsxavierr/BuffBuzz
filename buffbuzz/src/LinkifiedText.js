import React from 'react';

export function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function linkifySegment(segment, keyPrefix) {
  const parts = [];
  let last = 0;
  let match;
  const re = /https?:\/\/[^\s<>"']+/gi;
  let i = 0;
  while ((match = re.exec(segment)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={`${keyPrefix}-t-${i++}`}>{segment.slice(last, match.index)}</span>
      );
    }
    const href = match[0].replace(/[),.;!?]+$/g, '');
    parts.push(
      <a
        key={`${keyPrefix}-a-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="nl-inline-link"
      >
        {match[0]}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < segment.length) {
    parts.push(<span key={`${keyPrefix}-t-${i++}`}>{segment.slice(last)}</span>);
  }
  return parts.length ? parts : segment;
}

export default function LinkifiedText({ text, className }) {
  if (text == null || text === '') return null;
  const lines = String(text).split('\n');
  return (
    <div className={className}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {linkifySegment(line, `l${li}`)}
        </React.Fragment>
      ))}
    </div>
  );
}
