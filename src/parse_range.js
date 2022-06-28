class ParseError extends Error {}

/**
 * Parse ranges in strings.
 * Syntax: `[a][..[=][b]]`
 * @param {string} spec
 * @example (valid) `a`, `a..`, `..b`, `a..b`, `a..=`, `..=b`, `a..=b`
 * @example (optional) ``, `..`, `..=`
 * @returns {{min: string; max: string; inclusive: boolean; strict: boolean;}}
 * - `min`: The minimum part of the range. E.g `5` in `5..10`
 * - `max`: The maximum part of the range. E.g `10` in `5..10`
 * - `inclusive`: Whether or not the maximum is a part of the range. E.g `true` in `5..=10`
 * - `strict`: Whether or not the spec was not a range. E.g `true` in `7`
 */
export default function parseRange(spec) {
  let [min, max] = [];
  const sepIndex = spec.indexOf("..");
  [min, max] = (
    ~sepIndex ? [spec.slice(0, sepIndex), spec.slice(sepIndex + 2)] : [spec]
  ).map((part) => part.trim());
  let inclusive = !!max && max.startsWith("=");
  [min, max] = [min, inclusive ? (max ? max.slice(1) : min) : max].map(
    (part) => part || undefined
  );
  const strict = !~sepIndex;
  if (strict && !max) [max, inclusive] = [min, true];
  return { min, max, inclusive, strict };
}

/**
 * Parse a number-typed range
 * @param {*} spec
 * @param {*} strictSyntax Whether or not to throw on invalid parts
 * @example (valid) `1`, `1..`, `..5`, `1..5`, `1..=`, `..=5`, `1..=5`
 */
parseRange.num = function parseNumRange(spec, strictSyntax = false) {
  let { min, max, inclusive } = parseRange(spec);
  [min = -Infinity, max = Infinity, inclusive = inclusive] = [min, max].map(
    (part) => part && parseInt(part, 10)
  );
  if (strictSyntax && [min, max].some(Number.isNaN))
    throw new ParseError(`Invalid num range spec syntax \`${spec}\``);
  return {
    parsed: { min, max, inclusive },
    check: (num) => num >= min && (inclusive ? num <= max : num < max),
  };
};

/**
 * Parse a duration oriented range
 * @param {*} spec
 * @param {*} strictSyntax Whether or not to throw on invalid parts
 * @example (valid) `1s`, `00:30..`, `..3:40`, `20..1:25`, `1s..=60000ms`, `..=200s`, `2:30..=310000ms`
 */
parseRange.time = function parseTimeRange(spec, strictSyntax = false) {
  const cast = (val) =>
    val !== undefined
      ? val.includes(":")
        ? val.split(":").reduce((acc, time) => 60 * acc + +time) * 1000
        : val.endsWith("h")
        ? parseInt(val.slice(0, -1), 10) * 3600000
        : val.endsWith("m")
        ? parseInt(val.slice(0, -1), 10) * 60000
        : val.endsWith("ms")
        ? parseInt(val.slice(0, -2), 10)
        : val.endsWith("s")
        ? parseInt(val.slice(0, -1), 10) * 1000
        : parseInt(val, 10) * 1000
      : val;
  let { min, max, inclusive } = parseRange(spec);
  [min = -Infinity, max = Infinity, inclusive = inclusive] = [min, max].map(
    cast
  );
  if (strictSyntax && [min, max].some(Number.isNaN))
    throw new ParseError(`Invalid time range spec syntax \`${spec}\``);
  return {
    parsed: { min, max, inclusive },
    check: (time) => time >= min && (inclusive ? time <= max : time < max),
  };
};
