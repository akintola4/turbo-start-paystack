import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { MarkImage } from "@/components/brand-image";
import { BRAND } from "@/lib/brand";

export const alt =
  "Turbo Start Paystack: every price, in their money. Auth, orgs and Paystack billing in naira, cedis, rand, shillings and dollars.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const geist = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
const local = join(process.cwd(), "src/app/fonts");

// Satori takes static TTFs. Geist has no static 800 and no ₦/₵, so both
// come from small files cut from the variable fonts (see fonts/).
const fonts = Promise.all([
  readFile(join(geist, "Geist-Regular.ttf")),
  readFile(join(geist, "Geist-Bold.ttf")),
  readFile(join(local, "geist-800-latin.ttf")),
  readFile(join(local, "currency-symbols-700.ttf")),
]);

const WALL = ["₦", "₵", "R", "KSh", "$"];

export default async function OpengraphImage() {
  const [regular, bold, extraBold, currency] = await fonts;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        backgroundColor: BRAND.forest,
        color: BRAND.paper,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <MarkImage cell={BRAND.cellOnPanel} size={44} tile={BRAND.forestTile} />
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.9 }}>
          Turbo Start Paystack
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -4.8,
          lineHeight: "92px",
        }}
      >
        <span>Every price,</span>
        <span>in their money.</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {WALL.map((glyph, i) => (
            <div
              key={glyph}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 76,
                height: 76,
                borderRadius: 18,
                backgroundColor: i === 0 ? BRAND.sunflower : BRAND.forestTile,
                color: i === 0 ? BRAND.ink : BRAND.paper,
                fontSize: glyph.length > 1 ? 24 : 36,
                fontWeight: 700,
              }}
            >
              {glyph}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            fontSize: 22,
            lineHeight: "30px",
            color: BRAND.muted,
          }}
        >
          <span>Auth, orgs and Paystack billing</span>
          <span>Free and MIT-licensed</span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400 },
        { name: "Geist", data: bold, weight: 700 },
        { name: "Geist", data: extraBold, weight: 800 },
        { name: "Currency", data: currency, weight: 700 },
      ],
    }
  );
}
