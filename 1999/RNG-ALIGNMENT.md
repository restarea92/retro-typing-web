# 1999 RNG alignment — 2026-10-26

## Production changes

The LCG and modulo mapping already matched the original and are retained.
Two confirmed differences are corrected:

1. **Time-to-seed conversion.** Previously the web used Unix seconds. The
   original consumes the DOS local calendar, converts it using the executable's
   default `EST5EDT` policy, then truncates to 16 bits. Its historical DST is
   first Sunday in April from 1987 (last Sunday in April earlier), through last
   Sunday in October, at 02:00. This is not today's IANA/US DST policy.
   `original-dos-time.js` reproduces that conversion, using browser local
   calendar fields as the DOS clock input. The supported/verified years are
   1980–2099. Custom DOS `TZ` environments are outside this default-mode model.
2. **Game initialization boundary.** Opening or cancelling the game intro must
   not reseed or preselect words. Initialization now occurs when the normal
   start input is accepted, after the intro wait, and once per start. This also
   samples the correct acceptance-time clock instead of the menu-entry clock.

Normal product visits are **not fixed-seed**. A stream starts at state 1 once
per application launch and is shared across modes, just like the original.

## Original instruction evidence

All offsets below are **file offsets**, not run-time segment addresses. Verified
original `HTTD.EXE` SHA-256:

`8eaf841b5af1810687b26b7b07c16de0e2d434546c19c6088d31a228fb38d1f5`

| Behavior | Original evidence |
|---|---|
| `srand` | `0x48cc`: 16-bit argument, high state word zeroed |
| `rand` | `0x48dd`, multiplication helper `0x4894` |
| Update/output | `state = (state * 0x015a4e35 + 1) mod 2^32`; `(state >> 16) & 0x7fff` |
| Range mapping | `rand() % positive_bound`, not floating-point scaling |
| Calendar | getdate/gettime `0x45d8` / `0x45eb`; conversion `0x6e14`; TZ initialization `0x7142`; DST `0x7330` |
| Game start | `0x16ec4` calls key wait; `0x16efc` Escape returns before `0x16f17` calls initialization `0x14a9a` |

Five direct time/reseed pairs:

| Operation | time call | srand call |
|---|---:|---:|
| Word study entry, after warmup | `0x10457` | `0x1045f` |
| Short text entry | `0x11476` | `0x1147e` |
| Game word initialization after start | `0x14af4` | `0x14afc` |
| Rain special effect | `0x1626a` | `0x16272` |
| Invaders special effect | `0x171b1` | `0x171b9` |

Warmup (`0xefb8`) and key drill (`0xfb6b`, `0xfba7`) consume the shared
stream without reseeding; the key pool's first cycle remains ordered. Word and
short-text Continue paths do not reseed. Reentry takes their reseed path.
Short text draws at `0x1133f`; dictionary selection at `0x14984`.
Game initialization selects 60 ordinary words, then 10 English or 5 CJK bonus
words. Rain spawn gate `0x15a18` uses `% 4`, horizontal selection `0x15a73`
uses `% (81 - byteLength)`, and eligible special selection `0x15a8f` uses `% 3`.
Special effects consume one `% 19 + 1` result after reseeding (`0x16278`,
`0x171bf`). The audited binary has 33 direct rand calls; 21 belong to generated
text synthesis, plus two initialization calls in the non-dictionary branch.
The normal game menu selects the dictionary flag `0x80`, not those synthesis
paths. No unrelated synthesis/state/level hacks are included.

## Explicit QA seed opt-in

- Web alone: `?qa=1&qaRngSeed=12345`.
- Comparison workbench: `/qa/?qaRngSeed=12345`; it forwards the parameter to web.
- Accepted format is one canonical decimal value `0`–`65535`. Without exactly
  one `qa=1`, or with empty, duplicate, noncanonical or out-of-range values, the
  web stays in normal time-seed mode.
- QA fixes only the five reseeds. **Initial state remains 1**; it is not replaced
  by the QA seed. Removing the query restores normal behavior.
- A web query alone does not change DOS. The workbench labels web-only fixed
  seeds and verifies original/fixed-copy executable provenance separately.
- Read-only `rng` status never asserts timing or gameplay synchronization.

### Local DOS QA copy, never a replacement for the original

From the repository root, using a privately held original archive:

```sh
python3 scripts/make-rng-qa-copy.py ORIGINAL.zip HTTD-QA-FIXED-SEED-12345.jsdos --seed 12345
```

Select this new copy with the workbench's normal **DOS file open** control and
use the same web seed. The tool also accepts a standalone executable, but that
alone is not a complete workbench archive. It neither downloads nor supplies
original assets. Keep original, copy and generated manifest private.

Exact patch: file offsets `0x48cf..0x48d1`, **3 bytes**:

```text
8b 46 06      mov ax, [bp+6]     ; caller's 16-bit srand argument
b8 LL HH      mov ax, 0xHHLL     ; explicit QA seed
```

The tool validates the whole original SHA-256 and expected instruction,
requires a visibly labelled output filename, refuses source/existing-output
overwrite, and records both hashes and the unchanged-outside-patch hash.
All other bytes, including initial state 1, remain unchanged. Reversion means
selecting the untouched original again, not modifying the original in place.
The workbench recognizes a fixed copy only if restoring those three bytes in
a temporary inspection buffer yields the exact original hash. It never patches
loaded bytes itself. No original or patched executable belongs in a public
repository or deployment.

## Verification and limits

- Executed the original relocated x86 instructions in Unicorn 2.1.4. OS inputs
  were DOS date/time and absent `TZ`; no replacement RNG was used as the oracle.
- Every 16-bit seed's first output/state (65,536 cases) and six streams of
  10,000 output/state pairs agree with JS. Public tests retain numeric digests.
- 73,110 original time-conversion cases agree: every valid day in 1980–2099 at
  12:34:56, plus hours 00, 01, 02 and 23 in April/October. This is not every second.
- Six isolated original game-routine fixtures, synthetic dictionaries and
  graphics-only stubs: 12 JS initializers and 120 spawn attempts match, including
  411 initialization and 170 spawn RNG events. This is not full-game execution.
- Five QA seeds × five different caller seed arguments × 100 draws: 2,500
  native post-reseed outputs/states match; 80 initial draws and all nonpatch
  bytes remain unchanged. The actual generated archive was separately checked.
- Actual common-workbench execution with seed 12345, normal shared keyboard/
  mouse input: initial-state warmup, first word-study line, first and next short
  sentence, and all 30 visible stage-1 Invaders words matched DOS and web.
  This was bounded observation, **not a continuous game clear**.
- Calendar-driven unit fixtures, explicit opt-in validation, game intro/cancel/
  start regression and QA provenance tests supplement those observations.

**Same seed does not mean identical event timing, clock, call order, dictionary,
language or gameplay.** Actual short-text timing already differed (5.9 vs 6.0
seconds) while text and typed-unit counts matched. Future divergence must be
classified, not hidden with game-state changes.
