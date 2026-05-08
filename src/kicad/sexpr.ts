export type SExpression = string | SExpression[];

export function parseSExpression(input: string): SExpression {
  const tokens = tokenize(input);
  const stack: SExpression[][] = [];
  let root: SExpression[] | undefined;

  for (const token of tokens) {
    if (token === "(") {
      const list: SExpression[] = [];
      if (stack.length > 0) {
        stack[stack.length - 1].push(list);
      }
      stack.push(list);
      if (!root) {
        root = list;
      }
      continue;
    }
    if (token === ")") {
      if (stack.length === 0) {
        throw new Error("unexpected closing parenthesis");
      }
      stack.pop();
      continue;
    }
    if (stack.length === 0) {
      throw new Error("token outside expression");
    }
    stack[stack.length - 1].push(token);
  }

  if (stack.length !== 0 || !root) {
    throw new Error("unbalanced S-expression");
  }
  return root;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push(char);
      i += 1;
      continue;
    }
    if (char === "\"") {
      let value = "";
      let closed = false;
      i += 1;
      while (i < input.length) {
        const current = input[i];
        if (current === "\\" && i + 1 < input.length) {
          value += input[i + 1];
          i += 2;
          continue;
        }
        if (current === "\"") {
          i += 1;
          closed = true;
          break;
        }
        value += current;
        i += 1;
      }
      if (!closed) {
        throw new Error("unterminated quoted string");
      }
      tokens.push(value);
      continue;
    }
    let value = "";
    while (i < input.length && !/\s|\(|\)/.test(input[i])) {
      value += input[i];
      i += 1;
    }
    tokens.push(value);
  }
  return tokens;
}
