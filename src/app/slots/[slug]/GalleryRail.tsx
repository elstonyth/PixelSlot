// src/app/slots/[slug]/GalleryRail.tsx
'use client';

// Horizontal review rail (spec decision #8): active card center stage,
// neighbors peek dimmer/smaller/angled from the edges; swipe with momentum
// snaps to a card; desktop gets visible prev/next buttons.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function GalleryRail({
  count,
  activeIndex,
  onIndexChange,
  reduced,
  children,
}: {
  count: number;
  activeIndex: number;
  onIndexChange: (i: number) => void;
  reduced: boolean;
  children: (index: number) => React.ReactNode;
}) {
  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i));
  return (
    <div className="relative flex w-full flex-col items-center gap-3">
      <div className="relative w-full overflow-hidden">
        <motion.div
          className="flex items-center"
          drag={count > 1 && !reduced ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 || info.velocity.x < -400) {
              onIndexChange(clamp(activeIndex + 1));
            } else if (info.offset.x > 60 || info.velocity.x > 400) {
              onIndexChange(clamp(activeIndex - 1));
            }
          }}
          animate={{ x: `calc(50% - ${activeIndex * 78}vw - 39vw)` }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 260, damping: 30 }
          }
          style={{ touchAction: 'pan-y' }}
        >
          {Array.from({ length: count }, (_, i) => {
            const isActive = i === activeIndex;
            return (
              <motion.div
                key={i}
                className="w-[78vw] max-w-[340px] shrink-0 px-2"
                animate={{
                  scale: isActive ? 1 : 0.82,
                  opacity: isActive ? 1 : 0.45,
                  rotateY: reduced ? 0 : (i - activeIndex) * -14,
                }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }
                }
                onClick={() => !isActive && onIndexChange(i)}
              >
                {children(i)}
              </motion.div>
            );
          })}
        </motion.div>
        {/* desktop prev/next */}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous card"
              onClick={() => onIndexChange(clamp(activeIndex - 1))}
              disabled={activeIndex === 0}
              className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 hover:text-white disabled:opacity-30 sm:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next card"
              onClick={() => onIndexChange(clamp(activeIndex + 1))}
              disabled={activeIndex === count - 1}
              className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 hover:text-white disabled:opacity-30 sm:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <p className={cn('text-[12px] font-medium text-white/50')}>
          {activeIndex + 1} of {count}
        </p>
      )}
    </div>
  );
}
