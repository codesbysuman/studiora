export function sanitizeAndParseJSON(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') throw new Error('Input is empty.');

  let cleaned = rawStr.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = cleaned.search(/[\[{]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No valid JSON structure found.');
  }
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);

  try { return JSON.parse(cleaned); } catch (_) {}

  // Repair common AI mistakes: HTML attributes using double quotes inside JSON strings.
  cleaned = cleaned.replace(/<([a-zA-Z0-9]+)\s+([^>]+?)>/g, (fullTag, tagName, attrs) => {
    const repaired = attrs.replace(/([a-zA-Z0-9\-_:]+)\s*=\s*(?:\\?")([^">]*?)(?:\\?")/g, "$1='$2'");
    return `<${tagName} ${repaired}>`;
  });

  cleaned = cleaned.replace(/=\\?"([^"\n\r<>]*?)\\?"/g, "='$1'");
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(cleaned); } catch (error) {
    throw new Error(`JSON Syntax Error: ${error.message}`);
  }
}
