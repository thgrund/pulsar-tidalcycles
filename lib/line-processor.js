'use babel'

export default class LineProcessor {
    // private static constants
  static #DIGIT_MIN = 48;
  static #DIGIT_MAX = 57;
  static #UPPERCASE_MIN = 65;
  static #UPPERCASE_MAX = 90;
  static #LOWERCASE_MIN = 97;
  static #LOWERCASE_MAX = 122;
  static #DOT = 46;
  static #MINUS = 45;
  static #COLON = 58;
  static #QUOTATION_MARK = 34;


  // Valid TidalCycles word chars
  static isValidTidalWordChar(character) {
    const code = character.charCodeAt(0);

    return (
      (code >= this.#DIGIT_MIN && code <= this.#DIGIT_MAX) ||
      (code >= this.#UPPERCASE_MIN && code <= this.#UPPERCASE_MAX) ||
      (code >= this.#LOWERCASE_MIN && code <= this.#LOWERCASE_MAX) ||
      code === this.#DOT ||
      code === this.#MINUS ||
      code === this.#COLON
    );
  }

  static isQuotationMark(character) {
    const code = character.charCodeAt(0);
    return code === this.#QUOTATION_MARK;
  }

  static findTidalWordRanges(line, callback) {
    let insideQuotes = false;
    let start = null;
    let end = null;
    let lastIdentifier = null;
    let currIdent = null;
    let funcName = null;
    let quoteIndex = 0;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];

      if (LineProcessor.isQuotationMark(char)) {
        if (currIdent !== null) {
          lastIdentifier = currIdent;
          currIdent = null;
        }

        if (!insideQuotes) {
          funcName = lastIdentifier;
          quoteIndex++;
        }

        insideQuotes = !insideQuotes;

        // closing quote: flush any last tidal word
        if (!insideQuotes && start !== null && end !== null) {
          callback({ start, end, functionName: funcName || "", quoteIndex });
          start = null;
          end = null;
        }
      } else if (insideQuotes) {
        if (LineProcessor.isValidTidalWordChar(char)) {
          if (start === null) {
            start = index;
            end = index;
          } else {
            end = index;
          }
        } else if (start !== null && end !== null) {
          callback({ start, end, functionName: funcName || "", quoteIndex });
          start = null;
          end = null;
        }
      } else {
        // outside quotes: track last identifier (function name)
        if (currIdent === null) {
          if (/[a-zA-Z_]/.test(char)) {
            currIdent = char;
          }
        } else {
          if (/[a-zA-Z0-9_]/.test(char)) {
            currIdent = currIdent + char;
          } else {
            lastIdentifier = currIdent;
            currIdent = null;
          }
        }
      }
    }

    // flush any open word at end of line (unclosed quotes)
    if (start !== null && end !== null) {
      callback({ start, end, functionName: funcName || "", quoteIndex });
    }
  }

  static controlPatternsRegex() {
    return new RegExp(/"([^"]*)"/g);
  }

  static exceptedFunctionPatterns() {
    return new RegExp(/numerals\s*=.*$|p\s.*$/);
  }
}
