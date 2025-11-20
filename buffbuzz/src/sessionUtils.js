// Session management utilities
// Sessions expire after 2 hours (7200000 milliseconds)

const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const SESSION_KEY = 'user';
const SESSION_TIMESTAMP_KEY = 'sessionTimestamp';

/**
 * Check if the current session is valid (not expired)
 * @returns {boolean} True if session exists and is not expired
 */
export function isSessionValid() {
  const user = localStorage.getItem(SESSION_KEY);
  const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  
  if (!user || !timestamp) {
    return false;
  }
  
  const sessionTime = parseInt(timestamp, 10);
  const currentTime = Date.now();
  const timeElapsed = currentTime - sessionTime;
  
  // Session is valid if less than 2 hours have passed
  return timeElapsed < SESSION_DURATION;
}

/**
 * Get the current user from localStorage if session is valid
 * @returns {Object|null} User object if session is valid, null otherwise
 */
export function getValidUser() {
  if (!isSessionValid()) {
    clearSession();
    return null;
  }
  
  try {
    const userData = localStorage.getItem(SESSION_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    clearSession();
    return null;
  }
}

/**
 * Set user session with timestamp
 * @param {Object} user - User object to store
 */
export function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
}

/**
 * Clear user session and timestamp
 */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TIMESTAMP_KEY);
}

/**
 * Get time remaining in session (in milliseconds)
 * @returns {number} Time remaining, or 0 if expired/invalid
 */
export function getSessionTimeRemaining() {
  const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  
  if (!timestamp) {
    return 0;
  }
  
  const sessionTime = parseInt(timestamp, 10);
  const currentTime = Date.now();
  const timeElapsed = currentTime - sessionTime;
  const timeRemaining = SESSION_DURATION - timeElapsed;
  
  return Math.max(0, timeRemaining);
}

