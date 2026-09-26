import { parsePort, parsePrintServerLink } from './config';

describe('printer control input', () => {
  it('accepts only complete, valid port numbers', () => {
    expect(parsePort('1024')).toBe(1024);
    expect(parsePort('65535')).toBe(65_535);
    for (const value of [
      '',
      '0',
      '1023',
      '65536',
      '9100abc',
      ' 9100',
      '9100 ',
      '1.5',
      '+9100',
      '-9100',
    ]) {
      expect(parsePort(value)).toBeNull();
    }
  });

  it('accepts only exact control links', () => {
    expect(parsePrintServerLink('airprint://printserver/start')).toBe('start');
    expect(parsePrintServerLink('airprint://printserver/stop')).toBe('stop');
    for (const url of [
      'https://printserver/start',
      'airprint://evil/printserver/start',
      'airprint://printserver/start/extra',
      'airprint://printserver/start?port=9100',
      'airprint://printserver/stop#again',
      'airprint://printserver/start/../stop',
    ]) {
      expect(parsePrintServerLink(url)).toBeNull();
    }
  });
});
