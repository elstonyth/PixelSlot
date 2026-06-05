# Probe the animated claw avif: is the top banner/wordmark zone static across frames?
# what's the timing? where does the claw move? Saves frame 0 + the most-different frame.
import pillow_avif  # noqa
import numpy as np
from PIL import Image

p = "docs/research/packdetail/frames/legend-1.avif"
im = Image.open(p)
n = im.n_frames
im.seek(0)
f0 = np.array(im.convert("RGB"))
H, W = f0.shape[:2]
by0, by1, bx0, bx1 = int(0.12 * H), int(0.26 * H), int(0.33 * W), int(0.66 * W)  # banner/wordmark zone
b0 = f0[by0:by1, bx0:bx1].astype(int)
cy0, cy1 = int(0.28 * H), int(0.78 * H)  # claw/prize zone
c0 = f0[cy0:cy1].astype(int)
durs, bdiff, cdiff = [], [], []
for i in range(n):
    im.seek(i)
    durs.append(im.info.get("duration", 0))
    fi = np.array(im.convert("RGB")).astype(int)
    bdiff.append(float(np.abs(fi[by0:by1, bx0:bx1] - b0).mean()))
    cdiff.append(float(np.abs(fi[cy0:cy1] - c0).mean()))
print("frames", n, "total_ms", sum(durs), "uniq_durs", sorted(set(durs)))
print("banner_zone_maxdiff %.3f (~0 => static across frames)" % max(bdiff))
print("claw_zone_maxdiff %.2f at frame %d" % (max(cdiff), int(np.argmax(cdiff))))
im.seek(0)
im.convert("RGB").save("docs/research/packdetail/frames/f000.png")
mi = int(np.argmax(cdiff))
im.seek(mi)
im.convert("RGB").save("docs/research/packdetail/frames/fmax.png")
print("saved f000.png and fmax.png (frame %d)" % mi)
