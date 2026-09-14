# analyze_snap.py — Preuves du design 11 Build sur les captures TAKATA
# (blanc dominant, accent vert #1B7A3D unique, pas de dégradé/orange hérité)
from PIL import Image
import os, sys, glob

GREEN = (27, 122, 61)      # #1B7A3D TAKATA
ORANGE = (232, 119, 34)    # #E87722 hérité (ne doit plus jouer)
GREEN_SOFT = (240, 247, 242)

def near(c, ref, tol=28):
    return all(abs(a - b) <= tol for a, b in zip(c, ref))

def analyze(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = im.load()
    n = W * H
    white = green = orange = dark = soft = 0
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            c = px[x, y]
            if min(c) > 236 and max(c) - min(c) < 14: white += 1
            elif near(c, GREEN): green += 1
            elif near(c, ORANGE): orange += 1
            elif near(c, GREEN_SOFT): soft += 1
            elif max(c) < 90: dark += 1
    tot = len(range(0, W, 2)) * len(range(0, H, 2))
    return {
        'fichier': os.path.basename(path), 'taille': f'{W}x{H}',
        'blanc %': round(100 * white / tot, 1),
        'vert accent #1B7A3D': green, 'vert doux (badges)': soft,
        'orange résiduel': orange, 'encre (texte)': dark
    }

if __name__ == '__main__':
    pat = sys.argv[1] if len(sys.argv) > 1 else 'captures/*.png'
    if '*' not in pat:
        pat = pat.rstrip('/\\') + '/*.png'
    files = sorted(glob.glob(pat))
    print(f"{'fichier':32} {'taille':9} {'blanc %':>7} {'vert':>5} {'soft':>5} {'orange':>7} {'encre':>6}")
    for f in files:
        r = analyze(f)
        print(f"{r['fichier']:32} {r['taille']:9} {r['blanc %']:>7} {r['vert accent #1B7A3D']:>5} {r['vert doux (badges)']:>5} {r['orange résiduel']:>7} {r['encre (texte)']:>6}")