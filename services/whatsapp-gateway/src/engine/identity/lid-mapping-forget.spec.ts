import { LidMappingStoreService } from './lid-mapping-store.service';

type Row = { lid: string; phone: string | null; sessionId: string | null };

function build(rows: Row[]) {
  let table = [...rows];
  const repo = {
    find: jest.fn(async ({ where }: { where?: Array<{ sessionId?: string; phone?: { value: string[] } }> } = {}) => {
      if (!where) return table;
      return table.filter(r =>
        where.some(c => (c.sessionId ? r.sessionId === c.sessionId : c.phone!.value.includes(r.phone ?? ''))),
      );
    }),
    delete: jest.fn(async ({ lid }: { lid: { value: string[] } }) => {
      table = table.filter(r => !lid.value.includes(r.lid));
    }),
    upsert: jest.fn(),
    findOne: jest.fn(async () => null),
  };
  const service = new LidMappingStoreService(repo as never);
  return { service, repo, rows: () => table };
}

describe('LidMappingStoreService.forget', () => {
  const seed: Row[] = [
    { lid: 'titular', phone: '5511999990000', sessionId: 'outra' },
    { lid: 'sem9', phone: '551199990000', sessionId: 'outra' },
    { lid: 'terceiro-desta', phone: '5521988887777', sessionId: 's1' },
    { lid: 'terceiro-outra', phone: '5531977776666', sessionId: 'outra' },
  ];

  it('removes listed phones and rows of this session, preserving rows of other sessions', async () => {
    const { service, rows } = build(seed);
    await service.reload();

    const removed = await service.forget(['5511999990000', '551199990000'], 's1');

    expect(removed).toBe(3);
    expect(rows().map(r => r.lid)).toEqual(['terceiro-outra']);
  });

  it('clears both in-memory indexes', async () => {
    const { service } = build(seed);
    await service.reload();

    await service.forget(['5511999990000'], 's1');

    expect(service.lidsForPhone('5511999990000')).toEqual([]);
    expect(service.lidsForPhone('5521988887777')).toEqual([]);
    expect(service.lidsForPhone('5531977776666')).toEqual(['terceiro-outra']);
  });

  it('propagates a persistence failure', async () => {
    const { service, repo } = build(seed);
    await service.reload();
    repo.delete.mockRejectedValueOnce(new Error('db down'));

    await expect(service.forget(['5511999990000'], 's1')).rejects.toThrow('db down');
  });
});
