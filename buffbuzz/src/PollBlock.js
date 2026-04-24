import { API_URL } from './config';
import React, { useState } from 'react';
import './PollBlock.css';

const API = API_URL;

/**
 * Renders a feed/group poll using the enriched `post.poll` shape from the API
 * (options with voteCount, voters, myVoteOptionId, totalVotes, isExpired, etc.).
 */
export default function PollBlock({ post, currentUserId, onPollUpdate }) {
  const poll = post?.poll;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!poll || !Array.isArray(poll.options)) return null;

  const options = [...poll.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const totalVotes = poll.totalVotes ?? options.reduce((s, o) => s + (o.voteCount ?? 0), 0);
  const canVote = Boolean(currentUserId) && !poll.isExpired && !poll.myVoteOptionId;
  const showVoters = !poll.anonymousVoting;

  const vote = async (optionId) => {
    if (!canVote || busy) return;
    setErr('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/posts/${post.id}/poll/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, optionId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || 'Could not record vote');
        return;
      }
      if (data.poll && onPollUpdate) onPollUpdate(data.poll);
    } catch (e) {
      setErr('Network error — try again');
    } finally {
      setBusy(false);
    }
  };

  const expiresLabel = poll.expiresAt
    ? `Ends ${new Date(poll.expiresAt).toLocaleString()}`
    : null;

  return (
    <div className="poll-block">
      {post.title && <h4 className="poll-block-title">{post.title}</h4>}
      {post.content && <p className="poll-block-desc">{post.content}</p>}

      <div className={`poll-block-meta ${poll.isExpired ? 'poll-ended' : ''}`}>
        {poll.isExpired ? 'Poll closed' : 'Poll'}
        {poll.anonymousVoting && ' · Anonymous'}
        {expiresLabel && ` · ${expiresLabel}`}
        {totalVotes > 0 && ` · ${totalVotes} vote${totalVotes === 1 ? '' : 's'}`}
      </div>

      {options.map((opt) => {
        const count = opt.voteCount ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isMine = poll.myVoteOptionId === opt.id;
        const showResults = Boolean(poll.myVoteOptionId) || poll.isExpired || totalVotes > 0;

        return (
          <div key={opt.id} className="poll-option-row">
            <button
              type="button"
              className={`poll-option-btn ${isMine ? 'selected mine' : ''}`}
              disabled={!canVote || busy}
              onClick={() => vote(opt.id)}
            >
              {opt.text}
            </button>
            {showResults && (
              <>
                <div className="poll-option-bar-wrap" aria-hidden>
                  <div className="poll-option-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="poll-option-stats">
                  <span>{pct}%</span>
                  <span>{count} vote{count === 1 ? '' : 's'}</span>
                </div>
                {showVoters && Array.isArray(opt.voters) && opt.voters.length > 0 && (
                  <div className="poll-voters">
                    {opt.voters
                      .map((u) =>
                        `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'User'
                      )
                      .join(' · ')}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {!currentUserId && !poll.isExpired && (
        <p className="poll-block-login-hint">Log in to vote on this poll.</p>
      )}
      {err && <p className="poll-block-error">{err}</p>}
    </div>
  );
}
