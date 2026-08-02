/**
 * ESC/POS command builder.
 *
 * Pure TypeScript and free of native imports on purpose: the bytes for a receipt
 * can be built and tested anywhere, and the only platform-specific part is the
 * transport that carries them to a printer.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Align = "left" | "center" | "right";

const ALIGN_CODES: Record<Align, number> = { left: 0, center: 1, right: 2 };

export class EscPosBuilder {
  private readonly chunks: number[] = [];
  /** Characters per line. 32 for 58mm paper, 48 for 80mm. */
  private readonly width: number;

  constructor(width = 32) {
    this.width = width;
    this.raw(ESC, 0x40); // initialise
  }

  raw(...bytes: number[]): this {
    this.chunks.push(...bytes);
    return this;
  }

  align(align: Align): this {
    return this.raw(ESC, 0x61, ALIGN_CODES[align]);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** Double height and width, used for the total. */
  big(on: boolean): this {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00);
  }

  text(value: string): this {
    for (const codeUnit of this.encode(value)) this.chunks.push(codeUnit);
    return this;
  }

  line(value = ""): this {
    return this.text(value).raw(LF);
  }

  /** Left label, right value, dot leader between. This is the receipt idiom. */
  columns(label: string, value: string): this {
    const room = this.width - value.length;
    const trimmedLabel = label.length > room ? label.slice(0, room - 1) : label;
    const gap = " ".repeat(Math.max(1, room - trimmedLabel.length));
    return this.line(`${trimmedLabel}${gap}${value}`);
  }

  /**
   * A value too long for the paper, broken at spaces and continued on the next
   * line under a hanging indent. For an address, which is the only free text on
   * a receipt and the one thing that will not fit on 58mm paper.
   *
   * A single word longer than the paper is cut rather than dropped — a printer
   * given no line break prints past the edge and loses the rest silently.
   */
  wrapped(label: string, value: string, indent = "  "): this {
    const room = Math.max(this.width - indent.length, 8);
    let current = label;

    for (const word of value.split(/\s+/).filter(Boolean)) {
      if (!current) {
        current = indent + word.slice(0, room);
        continue;
      }

      if (current.length + 1 + word.length <= this.width) {
        current = `${current} ${word}`;
        continue;
      }

      this.line(current);
      current = indent + word.slice(0, room);
    }

    return current ? this.line(current) : this;
  }

  divider(character = "-"): this {
    return this.line(character.repeat(this.width));
  }

  /** The paper equivalent of the ledger line. */
  ledgerLine(): this {
    return this.divider("- ");
  }

  feed(lines = 3): this {
    return this.raw(ESC, 0x64, lines);
  }

  cut(): this {
    return this.raw(GS, 0x56, 0x00);
  }

  build(): Uint8Array {
    return new Uint8Array(this.chunks);
  }

  /**
   * CP437-ish single byte encoding. Thermal printers are not UTF-8, so the peso
   * sign is written as "PHP" by the receipt template rather than mangled here.
   */
  private encode(value: string): number[] {
    const bytes: number[] = [];
    for (const character of value) {
      const code = character.codePointAt(0) ?? 0x3f;
      bytes.push(code < 0x80 ? code : 0x3f);
    }
    return bytes;
  }
}
