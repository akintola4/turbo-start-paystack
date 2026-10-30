import {
  BRAND,
  CELL,
  CELL_RADIUS,
  MARK_CELLS,
  MARK_LIT,
  MARK_RADIUS,
  MARK_VIEWBOX,
} from "@/lib/brand";

/**
 * The mark as plain SVG with hex colours, for next/og images (Satori can't
 * read CSS variables). `square` drops the tile's corners for the Apple icon,
 * which iOS rounds itself.
 */
export function MarkImage({
  size,
  tile = BRAND.forest,
  cell = BRAND.cell,
  square = false,
}: {
  size: number;
  tile?: string;
  cell?: string;
  square?: boolean;
}) {
  return (
    <svg
      aria-hidden
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill={tile}
        height={MARK_VIEWBOX}
        rx={square ? 0 : MARK_RADIUS}
        width={MARK_VIEWBOX}
      />
      {MARK_CELLS.map(([x, y]) => (
        <rect
          fill={cell}
          height={CELL}
          key={`${x}-${y}`}
          rx={CELL_RADIUS}
          width={CELL}
          x={x}
          y={y}
        />
      ))}
      <rect
        fill={BRAND.sunflower}
        height={CELL}
        rx={CELL_RADIUS}
        width={CELL}
        x={MARK_LIT[0]}
        y={MARK_LIT[1]}
      />
    </svg>
  );
}
