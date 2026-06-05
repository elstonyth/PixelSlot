# Feasibility: (1) are the on-disk -machine.avif still the ANIMATED originals? (2) can we
# re-encode the frames as an animated webp / animated avif, and at what size?
import pillow_avif  # noqa
import os
from PIL import Image

# (1) existing on-disk machine avifs animated?
for f in ["public/images/claw/legend-pack-machine.avif", "public/images/claw/mythic-pack-machine.avif",
          "public/images/claw/black-pack-jjnfuk-machine.avif"]:
    try:
        im = Image.open(f)
        print("ONDISK", f, "n_frames=", getattr(im, "n_frames", 1))
    except Exception as e:
        print("ONDISK", f, "ERR", repr(e))

# (2) re-encode the downloaded animated original
im = Image.open("docs/research/packdetail/frames/legend-1.avif")
frames = []
for i in range(im.n_frames):
    im.seek(i)
    frames.append(im.convert("RGB").copy())
print("source frames", len(frames), "orig avif KB", round(os.path.getsize("docs/research/packdetail/frames/legend-1.avif") / 1024))

wp = "docs/research/packdetail/frames/test-anim.webp"
frames[0].save(wp, save_all=True, append_images=frames[1:], duration=40, loop=0, quality=82, method=4)
print("animated WEBP KB", round(os.path.getsize(wp) / 1024))

ap = "docs/research/packdetail/frames/test-anim.avif"
try:
    frames[0].save(ap, save_all=True, append_images=frames[1:], duration=40, loop=0, quality=80)
    print("animated AVIF KB", round(os.path.getsize(ap) / 1024))
except Exception as e:
    print("animated AVIF save FAILED:", repr(e))
