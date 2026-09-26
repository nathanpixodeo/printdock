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
    expect(parsePrintServerLink('printdock://printserver/start')).toBe('start');
    expect(parsePrintServerLink('printdock://printserver/stop')).toBe('stop');
    for (const url of [
      'https://printserver/start',
      'printdock://evil/printserver/start',
      'printdock://printserver/start/extra',
      'printdock://printserver/start?port=9100',
      'printdock://printserver/stop#again',
      'printdock://printserver/start/../stop',
    ]) {
      expect(parsePrintServerLink(url)).toBeNull();
    }
  });
});
