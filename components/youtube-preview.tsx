export function YoutubePreview({ videoId, start, end }: { videoId: string; start: number; end: number }) {
  const roundedStart = Math.max(0, Math.floor(start));
  const roundedEnd = Math.max(roundedStart + 1, Math.floor(end));
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?start=${roundedStart}&end=${roundedEnd}&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className="space-y-2">
      <iframe
        className="aspect-video w-full rounded-md border border-line bg-black"
        src={src}
        title={`Preview YouTube ${videoId}`}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      <a
        className="inline-flex text-xs font-medium text-brand hover:text-blue-700"
        href={`https://www.youtube.com/watch?v=${videoId}&t=${roundedStart}s`}
        target="_blank"
        rel="noreferrer"
      >
        Buka preview langsung di YouTube
      </a>
    </div>
  );
}
