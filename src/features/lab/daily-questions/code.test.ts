import { describe, expect, test } from "bun:test";
import {
  CODE_ALPHABET,
  formatRoomCode,
  generateDeviceToken,
  generateRoomCode,
  hashIp,
  hashToken,
  normalizeRoomCode,
  roomCodeFromPath,
  safeEqual,
} from "./code";

describe("generateRoomCode", () => {
  test("is the requested length", () => {
    expect(generateRoomCode()).toHaveLength(12);
    expect(generateRoomCode(8)).toHaveLength(8);
    expect(generateRoomCode(20)).toHaveLength(20);
  });

  test("only uses the unambiguous alphabet", () => {
    for (let index = 0; index < 1000; index += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]+$`));
    }
  });

  test("never emits a character that can be misread", () => {
    const ambiguous = ["I", "L", "O", "U", "0", "1"];
    const everything = Array.from({ length: 500 }, () =>
      generateRoomCode(),
    ).join("");

    for (const character of ambiguous) {
      expect(everything).not.toContain(character);
    }
  });

  test("uses the whole alphabet, without bias", () => {
    // Rejection sampling should leave every symbol close to uniform. A `% 32`
    // slip would make the last two symbols impossible and skew the rest.
    const draws = 60_000;
    const everything = Array.from({ length: draws / 12 }, () =>
      generateRoomCode(),
    ).join("");

    const counts = new Map<string, number>();
    for (const character of everything) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }

    expect(counts.size).toBe(CODE_ALPHABET.length);

    const expected = everything.length / CODE_ALPHABET.length;
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(expected * 0.9);
      expect(count).toBeLessThan(expected * 1.1);
    }
  });

  test("does not repeat itself", () => {
    const codes = new Set(
      Array.from({ length: 2000 }, () => generateRoomCode()),
    );
    expect(codes.size).toBe(2000);
  });

  test("refuses a code too short to be safe", () => {
    expect(() => generateRoomCode(6)).toThrow();
    expect(() => generateRoomCode(11.5)).toThrow();
  });
});

describe("normalizeRoomCode", () => {
  test("accepts what a person types", () => {
    expect(normalizeRoomCode("abcd-efgh-jkmn")).toBe("ABCDEFGHJKMN");
    expect(normalizeRoomCode("  abcd efgh jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizeRoomCode("ABCDEFGHJKMN")).toBe("ABCDEFGHJKMN");
  });

  test("drops characters outside the alphabet rather than guessing", () => {
    expect(normalizeRoomCode("AB0CD1EF")).toBe("ABCDEF");
    // I, L and U are not in the alphabet; E is.
    expect(normalizeRoomCode("ABICDLEU")).toBe("ABCDE");
    expect(normalizeRoomCode("!!!")).toBe("");
  });

  test("survives a pasted share link", () => {
    expect(
      roomCodeFromPath("/en/lab/daily-questions/join/abcd-efgh-jkmn"),
    ).toBe("ABCDEFGHJKMN");
    expect(roomCodeFromPath("/id/lab/daily-questions/join/ABCDEFGHJKMN/")).toBe(
      "ABCDEFGHJKMN",
    );
    expect(roomCodeFromPath("/")).toBe("");
  });
});

describe("formatRoomCode", () => {
  test("groups for reading aloud", () => {
    expect(formatRoomCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
    expect(formatRoomCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(formatRoomCode("ABC")).toBe("ABC");
  });
});

describe("generateDeviceToken", () => {
  test("is url-safe, unpadded and long enough to be a secret", () => {
    for (let index = 0; index < 200; index += 1) {
      const token = generateDeviceToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  test("does not repeat itself", () => {
    const tokens = new Set(
      Array.from({ length: 2000 }, () => generateDeviceToken()),
    );
    expect(tokens.size).toBe(2000);
  });
});

describe("hashToken", () => {
  test("is a deterministic sha256 hex digest", () => {
    const token = "a-fixed-token";
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
  });

  test("differs for different tokens", () => {
    expect(hashToken("one")).not.toBe(hashToken("two"));
  });

  test("is not reversible by inspection", () => {
    const token = generateDeviceToken();
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("hashIp", () => {
  test("depends on the salt, so a bare IP hash is not recoverable", () => {
    expect(hashIp("203.0.113.7", "salt-a")).not.toBe(
      hashIp("203.0.113.7", "salt-b"),
    );
  });

  test("is stable for the same address and salt", () => {
    expect(hashIp("203.0.113.7", "salt")).toBe(hashIp("203.0.113.7", "salt"));
    expect(hashIp("203.0.113.7", "salt")).not.toBe(
      hashIp("203.0.113.8", "salt"),
    );
  });
});

describe("safeEqual", () => {
  test("compares without leaking length", () => {
    expect(safeEqual("ABCD", "ABCD")).toBe(true);
    expect(safeEqual("ABCD", "ABCE")).toBe(false);
    expect(safeEqual("ABCD", "ABC")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
