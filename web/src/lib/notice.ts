/* ------------------------------------------------------------------------
   The privacy notice, in the same design as ixian.io's.
   ixiscope sets no cookies, runs no analytics and makes no third-party
   requests, so there is nothing to consent to: the card only says so, once.
   "Seen" lives in localStorage under `ixs-notice` (with a version, asked
   again after twelve months); the footer's "Privacy settings" reopens it
   with `openNotice()`.
   ------------------------------------------------------------------------ */

export const NOTICE_KEY = 'ixs-notice';
const VERSION = 1;
const MAX_AGE = 365 * 24 * 3600 * 1000;

export function noticeSeen(): boolean {
  try {
    const raw = window.localStorage.getItem(NOTICE_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw) as { v: number; at: number };
    return c.v === VERSION && Date.now() - c.at < MAX_AGE;
  } catch {
    return false;
  }
}

export function markNoticeSeen() {
  try {
    window.localStorage.setItem(NOTICE_KEY, JSON.stringify({ v: VERSION, at: Date.now() }));
  } catch {
    /* storage blocked: the card shows again next visit */
  }
}

export const openNotice = () => window.dispatchEvent(new Event('ixs-notice-open'));
