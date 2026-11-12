import { paymentOptions } from './paymentOptions';

describe('paymentOptions', () => {
  it('для курьера по Минску — три варианта', () => {
    const opts = paymentOptions('courier_minsk');
    expect(opts).toContain('card');
    expect(opts).toContain('erip');
    expect(opts).toContain('courier');
  });

  it('для EMS — только карта и ЕРИП', () => {
    const opts = paymentOptions('ems');
    expect(opts).toContain('card');
    expect(opts).toContain('erip');
    expect(opts).not.toContain('courier');
  });

  it('для Белпочты — только карта и ЕРИП', () => {
    const opts = paymentOptions('belpost');
    expect(opts).toContain('card');
    expect(opts).toContain('erip');
    expect(opts).not.toContain('courier');
  });
});
