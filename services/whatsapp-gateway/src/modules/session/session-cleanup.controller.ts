import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProperty, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, Matches } from 'class-validator';
import { RequireRole, SessionScoped } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { SessionDataPurgeService, StoredPurgeResult } from '../chat-media/session-data-purge.service';
import { LidMappingStoreService } from '../../engine/identity/lid-mapping-store.service';
import { SessionLidResolver } from './session-lid-resolver.service';

export class DeleteLidMappingsDto {
  @ApiProperty({ description: 'Phone numbers, digits only, no leading +', type: [String] })
  @IsArray()
  @ArrayMaxSize(32)
  @Matches(/^\d{6,20}$/, { each: true })
  phones!: string[];
}

/**
 * Data-removal endpoints for one session. Deliberately do not require the session row: a retry after
 * a partial teardown must still clear what is left, so a 404 can never hide remaining rows.
 */
@ApiTags('sessions')
@Controller('sessions')
@SessionScoped()
export class SessionCleanupController {
  constructor(
    private readonly purge: SessionDataPurgeService,
    private readonly lidMappings: LidMappingStoreService,
    private readonly lidResolver: SessionLidResolver,
  ) {}

  @Delete(':id/messages/stored')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete this session's stored messages and archived media older than a date" })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiQuery({ name: 'before', required: true, description: 'ISO 8601 date' })
  @ApiResponse({ status: 200, description: 'Counts, with `pending` above zero when a file delete failed' })
  @ApiResponse({ status: 400, description: '`before` missing or invalid' })
  async deleteStored(@Param('id') id: string, @Query('before') before?: string): Promise<StoredPurgeResult> {
    const cutoff = parseBefore(before);
    return this.purge.purgeBefore(id, cutoff);
  }

  @Delete(':id/lid-mappings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete lid mappings of the given phones and those last written by this session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Count of persisted rows removed' })
  async deleteLidMappings(@Param('id') id: string, @Body() dto: DeleteLidMappingsDto): Promise<{ removed: number }> {
    const removed = await this.lidMappings.forget(dto.phones, id);
    this.lidResolver.forget(id, dto.phones);
    return { removed };
  }
}

function parseBefore(before: string | undefined): Date {
  if (!before || !/^\d{4}-\d{2}-\d{2}T/.test(before)) {
    throw new BadRequestException('`before` must be an ISO 8601 date');
  }
  const date = new Date(before);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('`before` must be an ISO 8601 date');
  }
  return date;
}
