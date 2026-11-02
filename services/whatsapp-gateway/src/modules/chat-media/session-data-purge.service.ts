import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Message } from '../message/entities/message.entity';
import { BaileysStoredMessage } from '../../engine/adapters/baileys-stored-message.entity';
import { StorageService } from '../../common/storage/storage.service';
import { createLogger } from '../../common/services/logger.service';

/** Rows handled per statement, same bound as the chat-media purge. */
const PURGE_BATCH_SIZE = 500;
const PURGE_MAX_BATCHES_PER_RUN = 200;

export interface StoredPurgeResult {
  messages: number;
  storedMessages: number;
  files: number;
  /** Rows older than `before` still present. Callers treat a non-zero value as "not done, retry". */
  pending: number;
}

/**
 * Deletes what one session keeps locally before a given date: `messages` rows (inline media copy
 * included), `baileys_stored_messages` rows and archived media files. Never touches another session.
 *
 * The archived file is deleted directly instead of waiting for the orphan sweep. A row whose file
 * delete fails is kept for the next run, same posture as ChatMediaArchiveService.purgeExpired, and
 * is reported in `pending`.
 */
@Injectable()
export class SessionDataPurgeService {
  private readonly logger = createLogger('SessionDataPurgeService');

  constructor(
    @InjectRepository(Message, 'data')
    private readonly messages: Repository<Message>,
    @InjectRepository(BaileysStoredMessage, 'data')
    private readonly storedMessages: Repository<BaileysStoredMessage>,
    private readonly storageService: StorageService,
  ) {}

  async purgeBefore(sessionId: string, before: Date): Promise<StoredPurgeResult> {
    const where = { sessionId, createdAt: LessThan(before) };
    let deletedMessages = 0;
    let deletedFiles = 0;
    // Rows whose file delete failed stay in the table; skipping them keeps the loop moving.
    let kept = 0;

    for (let batch = 0; batch < PURGE_MAX_BATCHES_PER_RUN; batch++) {
      const rows = await this.messages.find({
        where,
        select: { id: true, mediaPath: true },
        order: { id: 'ASC' },
        skip: kept,
        take: PURGE_BATCH_SIZE,
      });
      if (rows.length === 0) break;

      const deletableIds: string[] = [];
      for (const row of rows) {
        if (!row.mediaPath) {
          deletableIds.push(row.id);
          continue;
        }
        try {
          await this.storageService.deleteFile(row.mediaPath);
          deletableIds.push(row.id);
          deletedFiles += 1;
        } catch (err) {
          kept += 1;
          this.logger.warn(`Failed to delete archived media of message ${row.id}; keeping the row for the next run`, {
            error: String(err),
          });
        }
      }

      if (deletableIds.length > 0) {
        await this.messages.delete({ id: In(deletableIds) });
        deletedMessages += deletableIds.length;
      }
      if (rows.length < PURGE_BATCH_SIZE) break;
    }

    const stored = await this.storedMessages.delete(where);
    const pending = await this.messages.count({ where });

    return {
      messages: deletedMessages,
      storedMessages: stored.affected ?? 0,
      files: deletedFiles,
      pending,
    };
  }
}
