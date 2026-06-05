# Inspect the animated avif for a paste SEAM: extract a mid-animation frame (claw moved) and
# crop the band around the 27% cut line where the rebranded banner was pasted onto each frame.
import sys
import pillow_avif  # noqa
from PIL import Image

bases = sys.argv[1:] or ["modern-grails-noafw0", "pro-soccer-pack"]
for base in bases:
    im = Image.open(f"public/images/claw/{base}-anim.avif")
    n = im.n_frames
    im.seek(min(50, n // 2))
    fr = im.convert("RGB")
    W, H = fr.size
    fr.save(f"docs/research/packdetail/seam_{base}_full.png")
    fr.crop((0, int(0.18 * H), W, int(0.38 * H))).save(f"docs/research/packdetail/seam_{base}_band.png")
    print(f"{base}: {W}x{H} n={n} cut_line_y={int(0.27 * H)} (band crop covers 0.18-0.38H)")
