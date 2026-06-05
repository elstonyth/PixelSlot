# Which rebranded machines have an animated -machine.avif source on disk (frames>1)?
import pillow_avif  # noqa
import os
from PIL import Image

bases = ["mythic-pack", "legend-pack", "elite-pack", "platinum-pack", "rookie-pack", "trainer-pack",
         "starter-riftbound-pack", "black-pack-jjnfuk", "legend-pack-1dpaec", "modern-grails-noafw0", "pro-soccer-pack"]
for b in bases:
    f = f"public/images/claw/{b}-machine.avif"
    if os.path.exists(f):
        try:
            im = Image.open(f)
            print(f"{b:26s} avif frames={getattr(im,'n_frames',1)}")
        except Exception as e:
            print(f"{b:26s} avif ERR {e}")
    else:
        print(f"{b:26s} NO avif (webp-only — needs live re-download)")
