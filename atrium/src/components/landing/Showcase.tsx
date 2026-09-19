const SOURCE_PHOTOS = ['photo_02.jpg', 'photo_05.jpg', 'photo_12.jpg', 'photo_07.jpg'];
const FRAME_PHOTOS = ['photo_02.jpg', 'photo_05.jpg', 'photo_12.jpg'];

/**
 * Démonstration du passage des photos à la vidéo.
 *
 * À gauche, des photographies posées à plat. À droite, le même matériau en
 * mouvement dans un cadre vertical. Aucune légende n'explique la flèche : la
 * lecture doit être immédiate.
 */
export function Showcase() {
  return (
    <div className="flex items-center justify-center gap-6 sm:gap-12">
      <div className="relative hidden h-[232px] w-[260px] shrink-0 sm:block" aria-hidden="true">
        {SOURCE_PHOTOS.map((photo, index) => (
          <div
            key={photo}
            className="absolute h-[124px] w-[186px] overflow-hidden rounded-md border border-line bg-surface shadow-hair"
            style={{
              left: `${index * 22}px`,
              top: `${index * 26}px`,
              transform: `rotate(${(index - 1.5) * 2.1}deg)`,
              zIndex: index,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image servie par une route locale */}
            <img
              src={`/api/samples/${photo}`}
              alt=""
              className="h-full w-full object-cover opacity-90"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <div className="hidden items-center gap-2 text-faint sm:flex" aria-hidden="true">
        <span className="h-px w-10 bg-line-strong" />
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1 1l3.5 3.5L1 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </div>

      <div className="relative h-[300px] w-[169px] shrink-0 overflow-hidden rounded-xl border border-line bg-ink shadow-film sm:h-[360px] sm:w-[203px]">
        {FRAME_PHOTOS.map((photo, index) => (
          <div
            key={photo}
            className="absolute inset-0"
            style={{
              animation: 'atrium-cycle 12s linear infinite',
              animationDelay: `${index * 4}s`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image servie par une route locale */}
            <img
              src={`/api/samples/${photo}`}
              alt=""
              className="h-full w-full object-cover will-change-transform"
              style={{
                animation: 'atrium-kenburns 12s linear infinite',
                animationDelay: `${index * 4}s`,
              }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
