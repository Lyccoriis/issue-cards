import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

import { Slider } from '@/components/ui/slider';

export interface CropperHandle {
  crop: () => Promise<Blob | null>;
}

interface ImageCropperProps {
  src: string;
  aspect: number;
  round?: boolean;
  outWidth: number;
}

const MAX_ZOOM = 4;

const ImageCropper = forwardRef<CropperHandle, ImageCropperProps>(function ImageCropper(
  { src, aspect, round = false, outWidth },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const cover = natural.w && box.w ? Math.max(box.w / natural.w, box.h / natural.h) : 1;
  const scale = cover * zoom;

  const clamp = useCallback(
    (next: { x: number; y: number }, atScale: number) => {
      const minX = box.w - natural.w * atScale;
      const minY = box.h - natural.h * atScale;
      return {
        x: Math.min(0, Math.max(minX, next.x)),
        y: Math.min(0, Math.max(minY, next.y)),
      };
    },
    [box, natural],
  );

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    if (!natural.w || !box.w) return;
    setOffset(() =>
      clamp(
        { x: (box.w - natural.w * cover) / 2, y: (box.h - natural.h * cover) / 2 },
        cover,
      ),
    );
  }, [natural, box, cover, clamp]);

  function rescale(next: number) {
    const bounded = Math.min(MAX_ZOOM, Math.max(1, next));
    const after = cover * bounded;
    setOffset(current =>
      clamp(
        {
          x: box.w / 2 - (box.w / 2 - current.x) * (after / scale),
          y: box.h / 2 - (box.h / 2 - current.y) * (after / scale),
        },
        after,
      ),
    );
    setZoom(bounded);
  }

  useImperativeHandle(ref, () => ({
    crop: async () => {
      const image = imgRef.current;
      if (!image || !natural.w || !box.w) return null;

      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = Math.round(outWidth / aspect);
      const paint = canvas.getContext('2d');
      if (!paint) return null;

      paint.drawImage(
        image,
        -offset.x / scale,
        -offset.y / scale,
        box.w / scale,
        box.h / scale,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      return new Promise<Blob | null>(done => canvas.toBlob(done, 'image/png'));
    },
  }));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        ref={boxRef}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={event => {
          const from = drag.current;
          if (!from) return;
          setOffset(
            clamp(
              { x: from.ox + (event.clientX - from.x), y: from.oy + (event.clientY - from.y) },
              scale,
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onWheel={event => rescale(zoom + (event.deltaY < 0 ? 0.15 : -0.15))}
        className={`w-full min-w-0 max-w-full cursor-grab touch-none overflow-hidden border border-border bg-muted ${
          round ? 'rounded-full' : 'rounded-lg'
        }`}
        style={{ aspectRatio: aspect }}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={event =>
            setNatural({
              w: event.currentTarget.naturalWidth,
              h: event.currentTarget.naturalHeight,
            })
          }
          className="block max-w-none origin-top-left select-none"
          style={{
            width: natural.w || undefined,
            height: natural.h || undefined,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <ZoomOut size={15} strokeWidth={1.6} className="text-muted-foreground" />
        <Slider
          value={[zoom]}
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          aria-label="zoom"
          onValueChange={value => rescale(value[0])}
          className="flex-1"
        />
        <ZoomIn size={15} strokeWidth={1.6} className="text-muted-foreground" />
        <span className="tnum w-10 text-right text-[11px] text-muted-foreground">
          {zoom.toFixed(1)}x
        </span>
      </div>
    </div>
  );
});

export default ImageCropper;
