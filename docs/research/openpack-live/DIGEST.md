
## REVEAL (tap -> card) — 1017 rAF frames over 16934ms
### Stage timeline (ms from tap):
-      2  packs     "SHUFFLING… TAP TO SELECT A PACK TO OPEN"
-   3703  slab      "1 of 1 TAP TO REVEAL"
### Motion segments:
- t=     2 +3682ms  o         0.3 -> 0.01     spring(overshoot 4%)         DIV.pack-carousel-reflection#black-pack-icon.webp
- t=     2 +3682ms  ty          0 -> -224.5   ease-in                      DIV.pack-carousel-reflection#black-pack-icon.webp
- t=     2 +3682ms  ty          0 -> -224.5   ease-in                      DIV.pack-carousel-slot#black-pack-icon.webp
- t=     2 + 350ms  ty          0 -> 2.1      linear                       DIV.pack-carousel-inner#black-pack-icon.webp
- t=  1851 + 700ms  ty        2.1 -> -2.1     linear                       DIV.pack-carousel-inner#black-pack-icon.webp
- t=  3254 + 430ms  ty         -4 -> 428.6    ease-in                      DIV.pack-carousel-inner#black-pack-icon.webp
- t=  3269 + 182ms  o           1 -> 0        tw-default(0.4,0,0.2,1)      DIV.pointer-events-none.absolute.inset-0
- t=  3269 + 182ms  o           1 -> 0        tw-default(0.4,0,0.2,1)      DIV.relative.flex.w-full
- t=  3301 + 383ms  o           1 -> 0.39     ease-in                      DIV.pack-carousel-inner#black-pack-icon.webp
- t=  3718 + 384ms  o           0 -> 1        ease-out                     DIV.animate-summary-fade-in.absolute.left-0
- t=  3718 + 334ms  o           0 -> 0.98     easeOutCubic(0.22,0.61,0.36,1) DIV.relative.z-[5].flex#card-back.webp
- t=  3718 + 534ms  ty        200 -> 0        easeOutQuint(0.22,1,0.36,1)  DIV.relative.z-[5].flex#card-back.webp
- t=  3735 + 599ms  o           0 -> 0.99     ease-in-out                  DIV.revealv4-celestial-shimmer.absolute.inset-0
- t=  3735 + 282ms  o           0 -> 1        tw-default(0.4,0,0.2,1)      DIV.swipe-cardback-highlight.pointer-events-none
- t=  5036 + 583ms  o           0 -> 0.54     ease-in-out                  DIV.revealv4-celestial-shimmer-back.absolute.ins
- t=  7001 + 883ms  o           1 -> 0.01     ease-in-out                  DIV.revealv4-celestial-shimmer.absolute.inset-0
- t=  7967 + 733ms  o        0.55 -> 0.01     ease-in-out                  DIV.revealv4-celestial-shimmer-back.absolute.ins
- t= 10234 + 599ms  o           0 -> 0.99     ease-in-out                  DIV.revealv4-celestial-shimmer.absolute.inset-0
- t= 11534 + 583ms  o           0 -> 0.54     ease-in-out                  DIV.revealv4-celestial-shimmer-back.absolute.ins
- t= 13501 + 884ms  o           1 -> 0.01     ease-in-out                  DIV.revealv4-celestial-shimmer.absolute.inset-0
- t= 14467 + 734ms  o        0.55 -> 0.01     ease-in-out                  DIV.revealv4-celestial-shimmer-back.absolute.ins
- t= 16735 + 200ms  o           0 -> 0.23     ease-in                      DIV.revealv4-celestial-shimmer.absolute.inset-0
### CSS animations seen:
- pack-carousel-float|4.4s|ease-in-out  [DIV.pack-carousel-inner#black-pack-icon.webp]
- pack-carousel-exit|0.48s|cubic-bezier(0.55, 0, 0.85, 0.4)  [DIV.pack-carousel-inner#black-pack-icon.webp]
- summary-fade-in|0.4s|ease-out  [DIV.animate-summary-fade-in.absolute.left-0]
- swipe-card-back-first|0.6s|cubic-bezier(0.16, 1, 0.3, 1)  [DIV.relative.z-[5].flex#card-back.webp]
- revealv4-celestial-sweep|6.5s|ease-in-out  [DIV.revealv4-celestial-shimmer.absolute.inset-0]
- revealv4-celestial-sweep-bac|6.5s|ease-in-out  [DIV.revealv4-celestial-shimmer-back.absolute.ins]

## overlay-entrance — 133 frames over 2200ms
- t=    0 +2200ms o    0.45 -> 0.23  spring(overshoot 100%)     DIV.pack-carousel-reflection#black-pack-icon.webp
- t=    0 +2200ms ty   0 -> -224.5  ease-in                    DIV.pack-carousel-reflection#black-pack-icon.webp
- t=    0 +2200ms ty   0 -> -224.5  ease-in                    DIV.pack-carousel-slot#black-pack-icon.webp
- t=   17 + 233ms ty   0.7 -> 2.1  linear                     DIV.pack-carousel-inner#black-pack-icon.webp
- t= 1751 + 450ms ty   2.1 -> -0.6  linear                     DIV.pack-carousel-inner#black-pack-icon.webp

## cylinder-idle — 145 frames over 2403ms
- node: DIV.pack-carousel-cylinder#black-pack-icon.webp matrix(1, 0, 0, 1, 0, 0)

## cylinder-drag — 124 frames over 2062ms
- rotY: first 0° last 0°  range [0°, 0°]
- rotY(t): 32:0.0 113:0.0 198:0.0 281:0.0 363:0.0 446:0.0 529:0.0 613:0.0 695:0.0 779:0.0 862:0.0 946:0.0 1029:0.0 1113:0.0 1195:0.0 1279:0.0 1362:0.0 1446:0.0 1529:0.0 1612:0.0 1696:0.0 1780:0.0 1863:0.0 1945:0.0 2029:0.0
- node: DIV.pack-carousel-cylinder#black-pack-icon.webp matrix(1, 0, 0, 1, 0, 0)

## cylinder-shuffle — 113 frames over 1867ms
- rotY: first 0° last 0°  range [0°, 0°]
- rotY(t): 0:0.0 83:0.0 167:0.0 250:0.0 334:0.0 417:0.0 500:0.0 584:0.0 667:0.0 750:0.0 834:0.0 917:0.0 1000:0.0 1084:0.0 1167:0.0 1250:0.0 1334:0.0 1417:0.0 1500:0.0 1584:0.0 1668:0.0 1750:0.0 1834:0.0
- node: DIV.pack-carousel-cylinder#black-pack-icon.webp matrix3d(-0.5, 0, 0.866025, 0, 0, 1, 0, 0, -0.866025, 0, -0.

## HERO — 404 frames over 6995ms

## SCROLL-ENTRY
- candidate: {"i":0,"cls":"absolute inset-0 bg-gradient-to-t from-black/40 via-transpar","top":1215,"opacity":"0","transform":"matrix(1, 0, 0, 1, 0, 0)","transition":"opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)"}
- NO motion segments — the element did not animate on scroll-in (live likely has no entry reveal here)

## HOME CARD HOVER
- self.transition: all
- kid0(IMG.pointer-events-non).transition: opacity 1.2s ease-in-out
- kid1(IMG.pointer-events-non).transition: opacity 1.2s ease-in-out
- kid2(IMG.pointer-events-non).opacity: "0.986388" -> "0.500105"
- kid2(IMG.pointer-events-non).transition: opacity 1.2s ease-in-out
- kid3(IMG.pointer-events-non).opacity: "0.0136122" -> "0.499895"
- kid3(IMG.pointer-events-non).transition: opacity 1.2s ease-in-out
- kid4(DIV.pointer-events-non).transition: all

## CLAW CARD HOVER
- self.transition: all
- kid0(DIV.relative aspect-[3).transition: all
- kid1(IMG.h-full w-full obje).transform: "none" -> "matrix(1.09208, 0, 0, 1.09208, 0, 0)"
- kid1(IMG.h-full w-full obje).transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)
- kid2(IMG.h-5 w-5 object-con).transition: all

## CLAW CATALOG ROWS

# ===== PASS 2 =====

## HERO v2 — 508 frames over 9000ms
- image: STATIC
- pokemon: 
    t=2383 +689ms cx 1072->1024 wo 1->0.605 sc 1->0.8222 ease-out
    t=6915 +641ms cx 1024->1071 wo 0.594->0.01 sc 0.8188->0.702 ease-out
- onepiece: 
    t=2414 +636ms cx 1119->1072 wo 0.604->0.993 sc 0.8219->0.997 ease-out
    t=6883 +694ms cx 1072->1024 wo 1->0.605 sc 1->0.8222 ease-out
- basketball: 
    t=2414 +658ms cx 1072->1119 wo 0.006->0.593 sc 0.7013->0.8185 ease
    t=6915 +620ms cx 1119->1072 wo 0.604->0.992 sc 0.8219->0.9962 ease-out
- football: 
    t=2414 +781ms cx 1024->1072 wo 0.594->0 sc 0.8187->NaN ease
    t=6915 +663ms cx 1072->1119 wo 0.006->0.593 sc 0.7012->0.8185 ease

## REVEAL v2 (slab tap -> card) — 865 frames over 14403ms
- STAGE     16ms  metadata  "YEAR 2016 CATEGORY Pokemon GRADE PSA 10 UNCOMMON"
### Motion segments:
- t=    23 + 197ms o           0 -> 1        ease-out                   BUTTON.animate-swipe-suspense.absolute.inset-0
- t=   220 +1500ms o           0 -> 1        linear                     DIV.animate-swipe-suspense-label.mb-2.flex
- t=   220 +1666ms ty         16 -> 0        linear                     DIV.animate-swipe-suspense-label.mb-2.flex
- t=   320 +1483ms o           0 -> 1        linear                     DIV.animate-swipe-suspense-value.text-[42px].fon
- t=   320 +1616ms ty         12 -> 0        linear                     DIV.animate-swipe-suspense-value.text-[42px].fon
- t=  2619 + 117ms o           0 -> 1        ease-out                   DIV.animate-swipe-rarity-pill.mt-6.rounded-full
- t=  3636 + 405ms o           0 -> 1        ease-out                   DIV.animate-summary-fade-in.absolute.left-0
- t=  3636 + 270ms o           0 -> 1        tw(0.4,0,0.2,1)            DIV.relative.z-[5].flex#oKLQkoiHS1uJcgW3Rv-cropped
- t=  4041 + 296ms o           0 -> 1        ease-out                   DIV.mt-5.flex.flex-col
- t=  4041 + 296ms ty         24 -> 0        ease-out                   DIV.mt-5.flex.flex-col
### CSS animations seen:
- summary-fade-in|0.2s|ease-out|0s  [BUTTON.animate-swipe-suspense.absolute.inset-0]
- swipe-suspense-label|0.25s|cubic-bezier(0.34, 1.56, 0.64, 1)|0.2s  [DIV.animate-swipe-suspense-label.mb-2.flex]
- swipe-suspense-value|0.2s|cubic-bezier(0.34, 1.56, 0.64, 1)|0.3s  [DIV.animate-swipe-suspense-value.text-[42px].f]
- swipe-suspense-label|0.25s|cubic-bezier(0.34, 1.56, 0.64, 1)|0.9s  [DIV.animate-swipe-suspense-label.mb-2.flex]
- swipe-suspense-value|0.2s|cubic-bezier(0.34, 1.56, 0.64, 1)|1s  [DIV.animate-swipe-suspense-value.text-[42px].f]
- swipe-suspense-label|0.25s|cubic-bezier(0.34, 1.56, 0.64, 1)|1.6s  [DIV.animate-swipe-suspense-label.mb-2.flex]
- swipe-suspense-value|0.2s|cubic-bezier(0.34, 1.56, 0.64, 1)|1.7s  [DIV.animate-swipe-suspense-value.text-[42px].f]
- swipe-rarity-pill|0.3s|cubic-bezier(0.34, 1.56, 0.64, 1)|2.6s  [DIV.animate-swipe-rarity-pill.mt-6.rounded-ful]
- summary-fade-in|0.4s|ease-out|0s  [DIV.animate-summary-fade-in.absolute.left-0]
- summary-fade-in|0.28s|cubic-bezier(0.4, 0, 0.2, 1)|0s  [DIV.relative.z-[5].flex#oKLQkoiHS1uJcgW3Rv-cro]
- swipe-card-inner|0.3s|ease-out|0.4s  [DIV.mt-5.flex.flex-col]
- swipe-card-flip|0.6s|cubic-bezier(0.16, 1, 0.3, 1)|0s  [DIV.backface-hidden.animate-swipe-card-flip#oK]
- revealv4-glow-spin|3.5s|linear|0s  [DIV.absolute.inset-[-50%].animate-revealv4-glo]