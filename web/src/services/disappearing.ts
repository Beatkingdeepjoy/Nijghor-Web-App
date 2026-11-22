// Disappearing Messages Engine
// Automatically deletes expired messages from local browser IndexedDB

import { db } from '../db/schema';

class DisappearingMessagesEngine {
  private timer: any = null;

  public start() {
    this.stop();
    // Check every 10 seconds for expired messages
    this.timer = setInterval(() => {
      this.purgeExpiredMessages();
    }, 10000);

    // Initial check
    this.purgeExpiredMessages();
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async purgeExpiredMessages(): Promise<number> {
    const now = Date.now();
    try {
      const expiredMsgs = await db.messages
        .where('expiresAt')
        .belowOrEqual(now)
        .toArray();

      if (expiredMsgs.length > 0) {
        const ids = expiredMsgs.map((m) => m.id);
        await db.messages.bulkDelete(ids);
        console.log(`[Disappearing] Purged ${ids.length} expired messages from browser IndexedDB.`);
        return ids.length;
      }
    } catch (err) {
      console.warn('[Disappearing] Purge error:', err);
    }
    return 0;
  }
}

export const disappearingEngine = new DisappearingMessagesEngine();
