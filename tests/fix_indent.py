# -*- coding: utf-8 -*-
# tests/fix_indent.py — réindente la ligne tot = ... dans analyze_snap.py
import io

p = 'tests/analyze_snap.py'
with io.open(p, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

for i, l in enumerate(lines):
    if l.startswith('tot = len(range(0, W, 2))'):
        lines[i] = '    ' + l
        print('ligne %d réindentée' % (i + 1))
        break

with io.open(p, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))