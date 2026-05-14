// Phase 2.D — Target #3 surgical test coverage for the mutation operations
// engine (src/lib/lab/mutation/operations.ts).
//
// Maps to Phase 2.A audit:
//   - R-LAB-04 (Medium) — Protected-prefix enforcement (PROTECTED_PREFIXES
//     denies mutations under /etc /usr /var /proc /sys /root /boot)
//   - R-LAB-06 (Medium) — applyChmodMode parser (numeric + symbolic + `=`
//     operator POSIX deviation, locked via T-MO-CHMOD-EQ-GAP per Z.4)
//
// SENIOR ARCHITECT NOTE: each test starts with a fresh
// `createMutableFs(ROOT)` so cross-test state isolation is guaranteed —
// the deep-clone semantics in mutation/state.ts:deepCloneFs are exercised
// transitively. `applyMutation` is a pure function over (state, op); no
// mocks needed.
//
// REJECTED ALTERNATIVE: build inline tiny FS fixtures per test. Rejected
// because (a) protected-prefix tests need real Unix-shaped roots (/etc,
// /usr, /var) which ROOT provides, (b) ROOT-based tests document the
// integration boundary with the real filesystem.ts module, (c) the
// deep-clone cost is sub-millisecond per test.

import { describe, it, expect } from 'vitest'
import { applyMutation, createMutableFs, getMutableNode } from '../mutation/state'
import { ROOT } from '../filesystem'
import type { FSNode, FileNode } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshFs() {
  return createMutableFs(ROOT)
}

function fileAt(fs: ReturnType<typeof freshFs>, path: string): FileNode | null {
  const node: FSNode | null = getMutableNode(fs, path)
  return node?.type === 'file' ? node : null
}

describe('applyMutation — Phase 2.D Target #3 (R-LAB-04 protected-prefix, R-LAB-06 chmod parser)', () => {
  // ─── touch (T-MO01-04) ──────────────────────────────────────────────────────

  describe('touch', () => {
    it('T-MO01 — touch creates empty file at /tmp path under operator scope', () => {
      const fs = freshFs()
      // /home/operator exists in ROOT; use a subpath safe for mutation
      const result = applyMutation(fs, { kind: 'touch', path: '/home/operator/newfile.txt' })
      expect(result.success).toBe(true)
      expect(result.affectedPaths).toContain('/home/operator/newfile.txt')
      const node = fileAt(fs, '/home/operator/newfile.txt')
      expect(node?.content).toBe('')
    })

    it('T-MO02 — touch on /etc/passwd is denied (protected prefix)', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'touch', path: '/etc/passwd' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Permission denied/i)
    })

    it('T-MO03 — touch on existing file is idempotent (succeeds, no change)', () => {
      const fs = freshFs()
      const first = applyMutation(fs, { kind: 'touch', path: '/home/operator/idempotent.txt' })
      expect(first.success).toBe(true)
      const second = applyMutation(fs, { kind: 'touch', path: '/home/operator/idempotent.txt' })
      expect(second.success).toBe(true)
    })

    it('T-MO04 — touch with missing parent directory fails', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'touch', path: '/home/operator/no-such-dir/file.txt' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/No such file or directory/i)
    })
  })

  // ─── mkdir (T-MO05-08) ──────────────────────────────────────────────────────

  describe('mkdir', () => {
    it('T-MO05 — mkdir creates directory at operator-writable path', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'mkdir', path: '/home/operator/newdir' })
      expect(result.success).toBe(true)
      const node = getMutableNode(fs, '/home/operator/newdir')
      expect(node?.type).toBe('dir')
    })

    it('T-MO06 — mkdir on protected /var/log denied', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'mkdir', path: '/var/log/custom' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Permission denied/i)
    })

    it('T-MO07 — mkdir on existing directory fails (File exists)', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'mkdir', path: '/home/operator/twice' })
      const second = applyMutation(fs, { kind: 'mkdir', path: '/home/operator/twice' })
      expect(second.success).toBe(false)
      expect(second.error).toMatch(/File exists/i)
    })

    it('T-MO08 — mkdir with missing parent fails (current implementation does not auto-create parents)', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'mkdir', path: '/home/operator/missing-parent/child' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/No such file or directory/i)
    })
  })

  // ─── rm (T-MO09-13) ─────────────────────────────────────────────────────────

  describe('rm', () => {
    it('T-MO09 — rm removes a file', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/to-remove.txt' })
      const result = applyMutation(fs, { kind: 'rm', path: '/home/operator/to-remove.txt' })
      expect(result.success).toBe(true)
      expect(getMutableNode(fs, '/home/operator/to-remove.txt')).toBeNull()
    })

    it('T-MO10 — rm on protected /etc denied', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'rm', path: '/etc/passwd' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Permission denied/i)
    })

    it('T-MO11 — rm on non-empty directory without recursive flag fails', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'mkdir', path: '/home/operator/nonempty' })
      applyMutation(fs, { kind: 'touch', path: '/home/operator/nonempty/inside.txt' })
      const result = applyMutation(fs, { kind: 'rm', path: '/home/operator/nonempty', recursive: false })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Is a directory/i)
    })

    it('T-MO12 — rm with recursive=true removes non-empty directory', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'mkdir', path: '/home/operator/recur-dir' })
      applyMutation(fs, { kind: 'touch', path: '/home/operator/recur-dir/child.txt' })
      const result = applyMutation(fs, { kind: 'rm', path: '/home/operator/recur-dir', recursive: true })
      expect(result.success).toBe(true)
      expect(getMutableNode(fs, '/home/operator/recur-dir')).toBeNull()
    })

    it('T-MO13 — rm on missing target fails (No such file or directory)', () => {
      const fs = freshFs()
      const result = applyMutation(fs, { kind: 'rm', path: '/home/operator/never-existed.txt' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/No such file or directory/i)
    })
  })

  // ─── mv (T-MO14-17) ─────────────────────────────────────────────────────────

  describe('mv', () => {
    it('T-MO14 — mv renames a file within operator scope', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/orig.txt' })
      const result = applyMutation(fs, {
        kind: 'mv',
        from: '/home/operator/orig.txt',
        to: '/home/operator/renamed.txt',
      })
      expect(result.success).toBe(true)
      expect(getMutableNode(fs, '/home/operator/orig.txt')).toBeNull()
      expect(getMutableNode(fs, '/home/operator/renamed.txt')?.type).toBe('file')
    })

    it('T-MO15 — mv with protected source denied', () => {
      const fs = freshFs()
      const result = applyMutation(fs, {
        kind: 'mv',
        from: '/etc/passwd',
        to: '/home/operator/copy.txt',
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/protected path/i)
    })

    it('T-MO16 — mv with protected destination denied', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/safe.txt' })
      const result = applyMutation(fs, {
        kind: 'mv',
        from: '/home/operator/safe.txt',
        to: '/etc/hijacked.txt',
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/protected path/i)
    })

    it('T-MO17 — mv with missing source fails', () => {
      const fs = freshFs()
      const result = applyMutation(fs, {
        kind: 'mv',
        from: '/home/operator/never-existed.txt',
        to: '/home/operator/dest.txt',
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/No such file or directory/i)
    })
  })

  // ─── chmod numeric mode (T-MO18-22) ─────────────────────────────────────────

  describe('chmod numeric mode', () => {
    it('T-MO18 — chmod 755 sets rwxr-xr-x triplet', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/numeric755.txt' })
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/numeric755.txt',
        perms: '755',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/numeric755.txt')
      expect(node?.perms).toBe('-rwxr-xr-x')
    })

    it('T-MO19 — chmod 0755 strips leading zero and maps to rwxr-xr-x', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/numeric0755.txt' })
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/numeric0755.txt',
        perms: '0755',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/numeric0755.txt')
      expect(node?.perms).toBe('-rwxr-xr-x')
    })

    it('T-MO20 — chmod 644 sets rw-r--r--', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/numeric644.txt' })
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/numeric644.txt',
        perms: '644',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/numeric644.txt')
      expect(node?.perms).toBe('-rw-r--r--')
    })

    it('T-MO21 — chmod with invalid octal digit (8 or 9) is rejected', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/badnum.txt' })
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/badnum.txt',
        perms: '789',
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/invalid mode/i)
    })

    it('T-MO22 — chmod numeric on protected /etc denied (permission check precedes parse)', () => {
      const fs = freshFs()
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/etc/passwd',
        perms: '777',
      })
      expect(result.success).toBe(false)
      // Note: protected check fires before mode parse, so error is permission
      expect(result.error).toMatch(/not permitted/i)
    })
  })

  // ─── chmod symbolic mode (T-MO23-27) ────────────────────────────────────────

  describe('chmod symbolic mode', () => {
    it('T-MO23 — chmod +x adds exec bit across all scopes (default scope = a)', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/exec-target.txt' })
      // touch default perms: '-rw-r--r--'
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/exec-target.txt',
        perms: '+x',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/exec-target.txt')
      // owner=rwx, group=r-x, other=r-x
      expect(node?.perms).toBe('-rwxr-xr-x')
    })

    it('T-MO24 — chmod u+x adds exec bit to owner only', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/user-exec.txt' })
      // Start: -rw-r--r--
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/user-exec.txt',
        perms: 'u+x',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/user-exec.txt')
      // owner=rwx, group/other unchanged
      expect(node?.perms).toBe('-rwxr--r--')
    })

    it('T-MO25 — chmod g-r removes read from group only', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/group-noread.txt' })
      // Start: -rw-r--r--
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/group-noread.txt',
        perms: 'g-r',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/group-noread.txt')
      expect(node?.perms).toBe('-rw----r--')
    })

    it('T-MO26 — chmod o+rx adds read+exec to other', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/other-rx.txt' })
      // Start: -rw-r--r--
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/other-rx.txt',
        perms: 'o+rx',
      })
      expect(result.success).toBe(true)
      const node = fileAt(fs, '/home/operator/other-rx.txt')
      expect(node?.perms).toBe('-rw-r--r-x')
    })

    it('T-MO27 — chmod with malformed symbolic mode is rejected', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/malformed.txt' })
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/malformed.txt',
        perms: 'gobbledygook',
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/invalid mode/i)
    })
  })

  // ─── R-LAB-06 chmod = operator gap-test ─────────────────────────────────────

  describe('R-LAB-06 chmod = operator POSIX deviation (gap-test)', () => {
    it('T-MO-CHMOD-EQ-GAP — chmod g=r currently behaves as g+r (POSIX deviation locked as regression guard)', () => {
      // SENIOR ARCHITECT NOTE: R-LAB-06 (Phase 2.A audit Section 2):
      // `applyChmodMode` in mutation/operations.ts shares the `=` operator
      // code path with `+` (the `if (op === '+' || op === '=')` branch at
      // L78). POSIX semantics for `=` is "set scope to exactly these bits,
      // clear ALL unmentioned bits in the scope." The current implementation
      // only ADDS the named bits — does NOT clear unmentioned bits.
      //
      // Example: starting perms 'rwx' for group; `g=r` SHOULD result in
      // 'r--' for group; current implementation leaves it as 'rwx' (the
      // `+r` op finds `r` already there, no change; `w` and `x` are NOT
      // cleared).
      //
      // GAP-TEST PATTERN (Phase 1 R-21 lineage): this test asserts the
      // CURRENT (deviant) behavior so any change to chmod = operator
      // semantics will fail this test visibly. The deviation status
      // remains intentional, not accidental.
      //
      // FUTURE R-LAB-06 CLOSURE CYCLE:
      //   1. Implement POSIX-correct `=` semantics in applyChmodMode (the
      //      `op === '='` case clears the entire triplet for the named
      //      scope before applying the new bits)
      //   2. Replace this test with T-MO-CHMOD-EQ01 asserting POSIX
      //      behavior:
      //        applyMutation(fs, { kind: 'chmod', path: ..., perms: 'g=r' })
      //        expect node.perms.slice(4,7) === 'r--'  // group is exactly r
      //   3. Update R-LAB-06 row in audit doc Section 2 with FIXED status
      //
      // Until then: this test stays green by locking the deviant behavior.

      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/equals-op.txt' })
      // Start at chmod 770 so group has rwx → makes the deviation observable
      applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/equals-op.txt',
        perms: '770',
      })
      // Confirm setup: group is rwx
      let node = fileAt(fs, '/home/operator/equals-op.txt')
      expect(node?.perms).toBe('-rwxrwx---')

      // Apply g=r (POSIX: should clear w+x from group, leaving 'r--')
      const result = applyMutation(fs, {
        kind: 'chmod',
        path: '/home/operator/equals-op.txt',
        perms: 'g=r',
      })
      expect(result.success).toBe(true)
      node = fileAt(fs, '/home/operator/equals-op.txt')

      // CURRENT (deviant) behavior: group keeps rwx because = behaves as +
      // POSIX (future fix) would set group to r--
      // This assertion locks the CURRENT behavior:
      expect(node?.perms).toBe('-rwxrwx---')

      // The "should be" assertion (commented out — would fail today):
      // expect(node?.perms).toBe('-rwxr-----')  // POSIX semantics
    })
  })

  // ─── write (T-MO28-30) ──────────────────────────────────────────────────────

  describe('write', () => {
    it('T-MO28 — write replaces file content', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/writable.txt' })
      const result = applyMutation(fs, {
        kind: 'write',
        path: '/home/operator/writable.txt',
        content: 'first content',
        append: false,
      })
      expect(result.success).toBe(true)
      expect(fileAt(fs, '/home/operator/writable.txt')?.content).toBe('first content')

      // Second write replaces
      applyMutation(fs, {
        kind: 'write',
        path: '/home/operator/writable.txt',
        content: 'second content',
        append: false,
      })
      expect(fileAt(fs, '/home/operator/writable.txt')?.content).toBe('second content')
    })

    it('T-MO29 — write with append=true concatenates content', () => {
      const fs = freshFs()
      applyMutation(fs, { kind: 'touch', path: '/home/operator/append-target.txt' })
      applyMutation(fs, {
        kind: 'write',
        path: '/home/operator/append-target.txt',
        content: 'hello ',
        append: false,
      })
      applyMutation(fs, {
        kind: 'write',
        path: '/home/operator/append-target.txt',
        content: 'world',
        append: true,
      })
      expect(fileAt(fs, '/home/operator/append-target.txt')?.content).toBe('hello world')
    })

    it('T-MO30 — write to protected path denied', () => {
      const fs = freshFs()
      const result = applyMutation(fs, {
        kind: 'write',
        path: '/etc/passwd',
        content: 'hijack',
        append: false,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Permission denied/i)
    })
  })
})
