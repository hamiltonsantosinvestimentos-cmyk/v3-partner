import { SessionDataPurgeService } from './session-data-purge.service';

type Row = { id: string; sessionId: string; mediaPath?: string; createdAt: Date };

const OLD = new Date('2026-01-01T00:00:00Z');
const NEW = new Date('2026-03-01T00:00:00Z');
const BEFORE = new Date('2026-02-01T00:00:00Z');

function matches(row: Row, where: { sessionId: string }): boolean {
  return row.sessionId === where.sessionId && row.createdAt < BEFORE;
}

function build(rows: Row[], failing: string[] = []) {
  const table = [...rows];
  const messages = {
    find: jest.fn(async ({ where, skip, take }: { where: { sessionId: string }; skip: number; take: number }) =>
      table.filter(r => matches(r, where)).slice(skip, skip + take),
    ),
    delete: jest.fn(async ({ id }: { id: { value: string[] } }) => {
      for (const target of id.value) {
        table.splice(
          table.findIndex(r => r.id === target),
          1,
        );
      }
    }),
    count: jest.fn(async ({ where }: { where: { sessionId: string } }) => table.filter(r => matches(r, where)).length),
  };
  const stored = { delete: jest.fn(async () => ({ affected: 2 })) };
  const storage = {
    deleteFile: jest.fn(async (path: string) => {
      if (failing.includes(path)) throw new Error('storage down');
    }),
  };
  const service = new SessionDataPurgeService(messages as never, stored as never, storage as never);
  return { service, table, storage, stored };
}

describe('SessionDataPurgeService', () => {
  it('deletes old rows and files of the session only', async () => {
    const { service, table, storage } = build([
      { id: 'a', sessionId: 's1', mediaPath: 'chat-media/s1/a.ogg', createdAt: OLD },
      { id: 'b', sessionId: 's1', createdAt: NEW },
      { id: 'c', sessionId: 's2', mediaPath: 'chat-media/s2/c.ogg', createdAt: OLD },
    ]);

    const result = await service.purgeBefore('s1', BEFORE);

    expect(result).toEqual({ messages: 1, storedMessages: 2, files: 1, pending: 0 });
    expect(table.map(r => r.id)).toEqual(['b', 'c']);
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith('chat-media/s1/a.ogg');
  });

  it('keeps the row and reports pending when the file delete fails', async () => {
    const { service, table } = build(
      [
        { id: 'a', sessionId: 's1', mediaPath: 'bad', createdAt: OLD },
        { id: 'b', sessionId: 's1', createdAt: OLD },
      ],
      ['bad'],
    );

    const result = await service.purgeBefore('s1', BEFORE);

    expect(result.pending).toBe(1);
    expect(result.messages).toBe(1);
    expect(table.map(r => r.id)).toEqual(['a']);
  });
});
