/*
 * highlight.ts — a tiny, dependency-free syntax tokenizer for the code panel.
 *
 * The landing page ships only react / react-dom / a font, on purpose. Pulling
 * in Prism or Shiki for three short, hand-picked snippets would be heavier than
 * the section itself. These snippets use only `//` line comments and
 * single-line strings, so NO token ever spans a newline — which lets us
 * tokenize each line independently and render cheap line numbers.
 *
 * Tokens are classified, never restyled here; the colours live in styles.css
 * (`.tk-*`) so the light/dark theme can recolour them via CSS variables.
 */

export type TokenType =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "literal"
  | "function"
  | "punct"
  | "plain";

export interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set([
  // Solidity
  "pragma", "solidity", "contract", "interface", "library", "function",
  "modifier", "struct", "enum", "mapping", "using", "for", "returns", "return",
  "require", "revert", "emit", "if", "else", "internal", "external", "public",
  "private", "view", "pure", "payable", "memory", "storage", "calldata",
  "immutable", "constant", "new", "is", "assembly", "unchecked", "override",
  "virtual",
  // TS / JS
  "import", "export", "from", "const", "let", "var", "type", "extends",
  "implements", "as", "readonly", "default",
]);

const TYPES = new Set([
  "address", "bool", "string", "bytes", "bytes32", "bytes4", "uint", "uint8",
  "uint256", "int", "int256", "IERC20", "IERC20Metadata", "PaymentAsset",
  "PaymentAssetType", "FundingStep", "number", "boolean", "bigint", "void",
  "Pick", "Record", "Array",
]);

const LITERALS = new Set([
  "true", "false", "null", "undefined", "this", "msg", "block", "super",
]);

// Ordered alternation, sticky. Groups: 1 comment · 2 string · 3 number ·
// 4 word · 5 punctuation · 6 whitespace.
const TOKEN_RE =
  /(\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(0x[0-9a-fA-F]+|\d[\d_]*(?:\.\d+)?)|([A-Za-z_$][\w$]*)|([{}()[\].,;:?@=+\-*/%<>!&|^~]+)|(\s+)/y;

function classifyWord(word: string, rest: string): TokenType {
  if (KEYWORDS.has(word)) return "keyword";
  if (TYPES.has(word)) return "type";
  if (LITERALS.has(word)) return "literal";
  // A bare identifier immediately followed by "(" reads as a call/definition.
  if (/^\s*\(/.test(rest)) return "function";
  return "plain";
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let i = 0;
  while (i < line.length) {
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(line);
    if (!m || m.index !== i) {
      // Unrecognised character — emit it raw so nothing is ever dropped.
      tokens.push({ text: line[i], type: "plain" });
      i += 1;
      continue;
    }
    const [whole, comment, str, num, word, punct] = m;
    if (comment !== undefined) tokens.push({ text: whole, type: "comment" });
    else if (str !== undefined) tokens.push({ text: whole, type: "string" });
    else if (num !== undefined) tokens.push({ text: whole, type: "number" });
    else if (word !== undefined)
      tokens.push({ text: whole, type: classifyWord(word, line.slice(TOKEN_RE.lastIndex)) });
    else if (punct !== undefined) tokens.push({ text: whole, type: "punct" });
    else tokens.push({ text: whole, type: "plain" }); // whitespace
    i = TOKEN_RE.lastIndex;
  }
  return tokens;
}

/** Tokenize a snippet into lines of tokens (one inner array per source line). */
export function highlight(code: string): Token[][] {
  return code.split("\n").map(tokenizeLine);
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  comment: "tk-com",
  string: "tk-str",
  number: "tk-num",
  keyword: "tk-key",
  type: "tk-typ",
  literal: "tk-lit",
  function: "tk-fn",
  punct: "tk-pun",
  plain: "tk-pl",
};
