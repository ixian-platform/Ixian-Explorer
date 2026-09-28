'use client';

import { openNotice } from '@/lib/notice';
import s from './Footer.module.css';

/** Footer link that reopens the privacy notice. */
export default function PrivacyButton() {
  return (
    <button type="button" className={s.settings} onClick={openNotice}>
      Privacy settings
    </button>
  );
}
