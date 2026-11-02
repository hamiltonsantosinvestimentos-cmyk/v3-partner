import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Message } from '../message/entities/message.entity';
import { ChatMediaArchiveService } from './chat-media-archive.service';
import { SessionDataPurgeService } from './session-data-purge.service';
import { BaileysStoredMessage } from '../../engine/adapters/baileys-stored-message.entity';
import { StorageModule } from '../../common/storage/storage.module';

/**
 * Standalone so both consumers can reach the archive without a cycle: SessionModule writes to it
 * from the inbound projector, MessageModule reads from it for the media endpoint, and MessageModule
 * already imports SessionModule. Mirrors StatusStoreModule, which sits in the same position.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Message, BaileysStoredMessage], 'data'), ConfigModule, StorageModule],
  providers: [ChatMediaArchiveService, SessionDataPurgeService],
  exports: [ChatMediaArchiveService, SessionDataPurgeService],
})
export class ChatMediaModule {}
