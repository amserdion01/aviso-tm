import { applies, isCondition, Condition, RoutingContext } from './condition';

const ctx = (over: Partial<RoutingContext> = {}): RoutingContext => ({
  valoareLei: 3000,
  necesitaIt: false,
  necesitaSsm: false,
  ...over,
});

describe('applies()', () => {
  it('null condition always applies', () => {
    expect(applies(null, ctx())).toBe(true);
  });

  it('value thresholds: gte / gt / lt', () => {
    const gte: Condition = { field: 'valoareLei', op: 'gte', value: 5000 };
    expect(applies(gte, ctx({ valoareLei: 5000 }))).toBe(true);
    expect(applies(gte, ctx({ valoareLei: 4999 }))).toBe(false);

    const gt: Condition = { field: 'valoareLei', op: 'gt', value: 5000 };
    expect(applies(gt, ctx({ valoareLei: 5000 }))).toBe(false);
    expect(applies(gt, ctx({ valoareLei: 5001 }))).toBe(true);

    const lt: Condition = { field: 'valoareLei', op: 'lt', value: 5000 };
    expect(applies(lt, ctx({ valoareLei: 4999 }))).toBe(true);
    expect(applies(lt, ctx({ valoareLei: 5000 }))).toBe(false);
  });

  it('boolean flags', () => {
    const it: Condition = { field: 'necesitaIt', eq: true };
    expect(applies(it, ctx({ necesitaIt: true }))).toBe(true);
    expect(applies(it, ctx({ necesitaIt: false }))).toBe(false);
  });

  it('all = AND, any = OR combinators', () => {
    const cond: Condition = {
      any: [
        { field: 'valoareLei', op: 'gte', value: 5000 },
        { field: 'necesitaIt', eq: true },
      ],
    };
    expect(applies(cond, ctx({ valoareLei: 3000, necesitaIt: true }))).toBe(true);
    expect(applies(cond, ctx({ valoareLei: 3000, necesitaIt: false }))).toBe(false);

    const both: Condition = {
      all: [
        { field: 'valoareLei', op: 'gte', value: 5000 },
        { field: 'necesitaSsm', eq: true },
      ],
    };
    expect(applies(both, ctx({ valoareLei: 6000, necesitaSsm: true }))).toBe(true);
    expect(applies(both, ctx({ valoareLei: 6000, necesitaSsm: false }))).toBe(false);
  });

  it('is defensive: a malformed condition never throws (treated as always)', () => {
    // These would previously crash `'all' in condition` / switch.
    expect(applies('nonsense' as unknown as Condition, ctx())).toBe(true);
    expect(applies(42 as unknown as Condition, ctx())).toBe(true);
    expect(applies({} as unknown as Condition, ctx())).toBe(true);
    expect(applies({ all: 'x' } as unknown as Condition, ctx())).toBe(true);
  });
});

describe('isCondition()', () => {
  it('accepts null and every valid shape', () => {
    expect(isCondition(null)).toBe(true);
    expect(isCondition({ field: 'valoareLei', op: 'gte', value: 5000 })).toBe(true);
    expect(isCondition({ field: 'necesitaIt', eq: true })).toBe(true);
    expect(
      isCondition({
        any: [
          { field: 'valoareLei', op: 'lt', value: 5000 },
          { field: 'necesitaSsm', eq: false },
        ],
      }),
    ).toBe(true);
  });

  it('rejects malformed conditions (would 400 at the boundary)', () => {
    expect(isCondition('nonsense')).toBe(false);
    expect(isCondition(42)).toBe(false);
    expect(isCondition([])).toBe(false);
    expect(isCondition({ field: 'valoareLei', op: 'between', value: 1 })).toBe(false);
    expect(isCondition({ field: 'valoareLei', op: 'gte' })).toBe(false);
    expect(isCondition({ field: 'necesitaIt', eq: 'yes' })).toBe(false);
    expect(isCondition({ field: 'unknown', eq: true })).toBe(false);
    expect(isCondition({ all: [{ field: 'bad' }] })).toBe(false);
  });
});
