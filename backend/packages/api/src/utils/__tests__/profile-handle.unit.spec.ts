import { HANDLE_RE, deriveHandle, slugifyName } from "../profile-handle";

// The public-profile handle is the customer's stable, PII-free URL identity:
// slug of the display name + a deterministic suffix hashed from the customer
// id. Determinism matters — the seed script and the ensure-handle workflow
// must derive the SAME handle for the same customer on every run, or re-runs
// would mint duplicates.

describe("slugifyName", () => {
  it("lowercases, trims, and collapses non-alphanumerics to single dashes", () => {
    expect(slugifyName("  Kenji  ")).toBe("kenji");
    expect(slugifyName("Mira O'Neill")).toBe("mira-o-neill");
    expect(slugifyName("a__b!!c")).toBe("a-b-c");
  });

  it("strips leading/trailing dashes and falls back for empty input", () => {
    expect(slugifyName("---")).toBe("collector");
    expect(slugifyName("")).toBe("collector");
    expect(slugifyName("ポケモン")).toBe("collector"); // non-latin → fallback
  });

  it("caps the slug length", () => {
    expect(slugifyName("x".repeat(200)).length).toBeLessThanOrEqual(40);
  });
});

describe("deriveHandle", () => {
  it("is deterministic for the same name + id", () => {
    const a = deriveHandle("Kenji", "cus_01ABCDEF");
    const b = deriveHandle("Kenji", "cus_01ABCDEF");
    expect(a).toBe(b);
  });

  it("differs for different customer ids (suffix from id hash)", () => {
    expect(deriveHandle("Kenji", "cus_01AAAAAA")).not.toBe(
      deriveHandle("Kenji", "cus_01BBBBBB"),
    );
  });

  it("changes with the attempt counter (collision retry)", () => {
    const first = deriveHandle("Kenji", "cus_01ABCDEF", 0);
    const second = deriveHandle("Kenji", "cus_01ABCDEF", 1);
    expect(first).not.toBe(second);
  });

  it("uses the fallback slug when the name is missing", () => {
    expect(deriveHandle(null, "cus_01ABCDEF")).toMatch(/^collector-/);
    expect(deriveHandle(undefined, "cus_01ABCDEF")).toMatch(/^collector-/);
  });

  it("always produces a handle that matches HANDLE_RE", () => {
    const samples = [
      deriveHandle("Kenji", "cus_01ABCDEF"),
      deriveHandle("Mira O'Neill", "cus_01XYZ"),
      deriveHandle("", "cus_01XYZ"),
      deriveHandle("x".repeat(200), "cus_01XYZ", 7),
    ];
    for (const h of samples) {
      expect(h).toMatch(HANDLE_RE);
    }
  });
});

describe("HANDLE_RE", () => {
  it("accepts plain kebab handles and rejects junk", () => {
    expect("kenji-8f3a").toMatch(HANDLE_RE);
    expect("UPPER").not.toMatch(HANDLE_RE);
    expect("has space").not.toMatch(HANDLE_RE);
    expect("a").not.toMatch(HANDLE_RE); // too short
    expect("x".repeat(80)).not.toMatch(HANDLE_RE); // too long
    expect("semi;colon").not.toMatch(HANDLE_RE);
  });
});
