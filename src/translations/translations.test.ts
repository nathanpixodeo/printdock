import en from './en-EN.json';
import fr from './fr-FR.json';
import vi from './vi-VN.json';

type JsonValue = string | { [key: string]: JsonValue };

function collectLeaves(value: JsonValue, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>();
  if (typeof value === 'string') {
    leaves.set(prefix, value);
    return leaves;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    for (const [leafPath, text] of collectLeaves(child, path)) {
      leaves.set(leafPath, text);
    }
  }
  return leaves;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)]
    .map((match) => match[1]!)
    .sort();
}

describe('translation catalogs', () => {
  const englishLeaves = collectLeaves(en);

  it.each([
    ['French', fr],
    ['Vietnamese', vi],
  ] as const)(
    'matches English keys and placeholders in %s',
    (_name, catalog) => {
      const translatedLeaves = collectLeaves(catalog);
      expect([...translatedLeaves.keys()].sort()).toEqual(
        [...englishLeaves.keys()].sort(),
      );

      for (const [path, englishText] of englishLeaves) {
        expect(placeholders(translatedLeaves.get(path)!)).toEqual(
          placeholders(englishText),
        );
      }
    },
  );
});
