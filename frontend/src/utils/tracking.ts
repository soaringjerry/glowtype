// Anonymous stats tracking (no PII)
import { getApiBaseUrl } from '../api/baseUrl';

export type TrackEventType = 'quiz_complete' | 'share_generate' | 'ai_chat_start' | 'ai_insight_use';

export const trackEvent = async (event: TrackEventType, typeCode?: string): Promise<void> => {
  try {
    await fetch(`${getApiBaseUrl()}/stats/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, typeCode }),
    });
  } catch (e) {
    // Silently fail - stats are not critical
    console.debug('Stats tracking failed:', e);
  }
};
