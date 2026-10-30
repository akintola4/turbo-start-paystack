import { readFile } from "node:fs/promises";
import {
  Document,
  Font,
  Page,
  Path,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoiceDocument } from "@workspace/billing";

import { type InvoiceView, invoiceView } from "../lib/invoice-view";

/*
 * Server-side PDF with @react-pdf/renderer: pure JavaScript (no headless
 * browser, so it runs in a normal serverless function), real embedded and
 * subset fonts, and the same flexbox layout model as the web view.
 *
 * Geist has no ₦ or ₵, exactly as on the web. The family stack below falls
 * back per glyph to a two-glyph Inter subset (SIL OFL), instanced at the
 * three weights used and scaled to 97.6% so ₦ shares Geist's cap height.
 */

/*
 * The fonts sit next to this file and are referenced with
 * `new URL(..., import.meta.url)`, which the bundler and file tracer follow,
 * so they ship with the deployment (a path into the geist package does not:
 * pnpm symlinks it and the function never gets the file). They are read inside
 * the request, never at module scope, and handed to react-pdf as data URLs,
 * so react-pdf never touches the disk. A missing font rejects this request
 * only, as a normal error, and the next request tries again.
 */
function fontFiles() {
  return Promise.all([
    readFile(new URL("./pdf-fonts/geist-400.ttf", import.meta.url)),
    readFile(new URL("./pdf-fonts/geist-500.ttf", import.meta.url)),
    readFile(new URL("./pdf-fonts/geist-600.ttf", import.meta.url)),
    readFile(new URL("./pdf-fonts/geist-mono-400.ttf", import.meta.url)),
    readFile(new URL("./pdf-fonts/currency-symbols-400.ttf", import.meta.url)),
    readFile(new URL("./pdf-fonts/currency-symbols-500.ttf", import.meta.url)),
    readFile(new URL("./pdf-fonts/currency-symbols-600.ttf", import.meta.url)),
  ]);
}

const dataUrl = (font: Buffer) =>
  `data:font/ttf;base64,${font.toString("base64")}`;

let registering: Promise<void> | null = null;
function registerFonts(): Promise<void> {
  registering ??= fontFiles().then(
    ([sans4, sans5, sans6, mono, cur4, cur5, cur6]) => {
      Font.register({
        family: "Geist",
        fonts: [
          { src: dataUrl(sans4), fontWeight: 400 },
          { src: dataUrl(sans5), fontWeight: 500 },
          { src: dataUrl(sans6), fontWeight: 600 },
        ],
      });
      Font.register({
        family: "Currency",
        fonts: [
          { src: dataUrl(cur4), fontWeight: 400 },
          { src: dataUrl(cur5), fontWeight: 500 },
          { src: dataUrl(cur6), fontWeight: 600 },
        ],
      });
      Font.register({ family: "GeistMono", src: dataUrl(mono) });
      // Invoice text is short; never hyphenate names, references or amounts.
      Font.registerHyphenationCallback((word) => [word]);
    },
    (error: unknown) => {
      registering = null;
      throw error;
    }
  );
  return registering;
}

/** Light "Market" palette (docs/design-system.md): paper is always light. */
const c = {
  paper: "#ffffff",
  text: "#131d18",
  muted: "#535e58",
  subtle: "#6d7772",
  rule: "#d7e1dc",
  well: "#f3f8f6",
  panel: "#0f3a25",
  tile: "#274e3b",
  panelText: "#e8efeb",
  panelMuted: "#afccbb",
  status: {
    paid: "#8cd384",
    refunded: "#a2aea8",
    failed: "#fe9b93",
    pending: "#92c4ee",
  },
};

const SANS = ["Geist", "Currency"];

const s = StyleSheet.create({
  page: {
    backgroundColor: c.paper,
    color: c.text,
    fontFamily: SANS,
    fontSize: 9.5,
    // No lineHeight here or on Views: inherited, react-pdf drops the
    // absolutely positioned footer and resolves it against an 18pt default.
    // Text styles that wrap set fontSize and lineHeight together.
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: c.panel,
    color: c.panelText,
    fontSize: 10,
    fontWeight: 600,
    textAlign: "center",
    paddingTop: 7,
  },
  brandName: { fontSize: 13, fontWeight: 600 },
  docTitle: { alignItems: "flex-end" },
  title: { fontSize: 9.5, color: c.muted },
  number: { fontSize: 13, fontWeight: 600 },
  panel: {
    backgroundColor: c.panel,
    color: c.panelText,
    borderRadius: 18,
    padding: 22,
    gap: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.tile,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 8.5, fontWeight: 600 },
  hero: {
    fontSize: 32,
    fontWeight: 600,
    letterSpacing: -0.6,
    lineHeight: 1,
  },
  caption: { color: c.panelMuted, fontSize: 9.5 },
  metaRow: { flexDirection: "row", gap: 8 },
  metaTile: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: c.tile,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 2,
  },
  metaLabel: { color: c.panelMuted, fontSize: 8 },
  metaValue: { fontSize: 9.5, fontWeight: 600 },
  parties: { flexDirection: "row", gap: 24, marginTop: 24 },
  party: { flexGrow: 1, flexBasis: 0, gap: 1.5 },
  label: {
    fontSize: 8,
    fontWeight: 500,
    color: c.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  partyName: { fontSize: 10.5, fontWeight: 600, marginBottom: 2 },
  partyLine: { color: c.muted, fontSize: 9.5, lineHeight: 1.45 },
  table: { marginTop: 26 },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: c.rule,
    paddingVertical: 9,
  },
  colDesc: { flexGrow: 1, flexBasis: 0, paddingRight: 16, gap: 1.5 },
  colAmount: { width: 120, textAlign: "right" },
  lineTitle: { fontWeight: 500, fontSize: 10 },
  lineDetail: { color: c.muted, fontSize: 9.5, lineHeight: 1.45 },
  totals: {
    alignSelf: "flex-end",
    width: 250,
    marginTop: 10,
    gap: 5,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalStrong: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: c.text,
    paddingTop: 7,
    marginTop: 3,
  },
  footer: {
    marginTop: 30,
    backgroundColor: c.well,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  footRow: { flexDirection: "row", gap: 6 },
  mono: { fontFamily: "GeistMono", fontSize: 8.5 },
  note: { color: c.muted, fontSize: 8.5, lineHeight: 1.45 },
  pageFoot: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    color: c.subtle,
    fontSize: 8,
    textAlign: "right",
  },
});

/** Lucide paths (24×24) for the status chip: check, undo-2, x, clock. */
const ICONS: Record<InvoiceView["status"], string[]> = {
  paid: ["M20 6 9 17l-5-5"],
  refunded: [
    "M9 14 4 9l5-5",
    "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",
  ],
  failed: ["M18 6 6 18", "m6 6 12 12"],
  pending: ["M12 6v6l4 2", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
};

function StatusChip({ view }: { view: InvoiceView }) {
  const color = c.status[view.status];
  return (
    <View style={s.chip}>
      <Svg height={8} viewBox="0 0 24 24" width={8}>
        {ICONS[view.status].map((d) => (
          <Path
            d={d}
            fill="none"
            key={d}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
        ))}
      </Svg>
      <Text style={[s.chipText, { color }]}>{view.statusLabel}</Text>
    </View>
  );
}

function Party({
  label,
  party,
}: {
  label: string;
  party: InvoiceView["from"];
}) {
  return (
    <View style={s.party}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.partyName}>{party.name}</Text>
      {party.lines.map((line) => (
        <Text key={line} style={s.partyLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function InvoicePdf({ view }: { view: InvoiceView }) {
  return (
    <Document
      author={view.from.name}
      creator={view.from.name}
      producer={view.from.name}
      subject={`${view.title} for ${view.to.name}`}
      title={view.number ?? view.title}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            <Text style={s.mark}>{view.mark}</Text>
            <Text style={s.brandName}>{view.from.name}</Text>
          </View>
          <View style={s.docTitle}>
            <Text style={s.title}>{view.title}</Text>
            {view.number ? <Text style={s.number}>{view.number}</Text> : null}
          </View>
        </View>

        <View style={s.panel}>
          <StatusChip view={view} />
          <View style={{ gap: 10 }}>
            <Text
              style={[
                s.hero,
                view.struck
                  ? {
                      textDecoration: "line-through",
                      color: c.panelMuted,
                    }
                  : {},
              ]}
            >
              {view.heroAmount}
            </Text>
            <Text style={s.caption}>{view.caption}</Text>
          </View>
          {view.meta.length > 0 ? (
            <View style={s.metaRow}>
              {view.meta.map((m) => (
                <View key={m.label} style={s.metaTile}>
                  <Text style={s.metaLabel}>{m.label}</Text>
                  <Text style={s.metaValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={s.parties}>
          <Party label="From" party={view.from} />
          <Party label="Billed to" party={view.to} />
        </View>

        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.label, s.colDesc, { marginBottom: 0 }]}>
              Description
            </Text>
            <Text style={[s.label, s.colAmount, { marginBottom: 0 }]}>
              Amount ({view.currency})
            </Text>
          </View>
          {view.lines.map((line) => (
            <View key={line.description} style={s.row} wrap={false}>
              <View style={s.colDesc}>
                <Text style={s.lineTitle}>{line.description}</Text>
                {line.detail ? (
                  <Text style={s.lineDetail}>{line.detail}</Text>
                ) : null}
              </View>
              <Text style={[s.colAmount, { fontWeight: 500 }]}>
                {line.amount}
              </Text>
            </View>
          ))}
          <View style={s.totals} wrap={false}>
            {view.totals.map((t) => (
              <View key={t.label} style={t.strong ? s.totalStrong : s.totalRow}>
                <Text
                  style={
                    t.strong
                      ? { fontWeight: 600, fontSize: 11 }
                      : { color: c.muted }
                  }
                >
                  {t.label}
                </Text>
                <Text
                  style={
                    t.strong
                      ? { fontWeight: 600, fontSize: 11 }
                      : { fontWeight: 500 }
                  }
                >
                  {t.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {view.reference ? (
          <View style={s.footer} wrap={false}>
            <View style={s.footRow}>
              <Text style={s.note}>Paystack reference</Text>
              <Text style={s.mono}>{view.reference}</Text>
            </View>
            {view.paystackInvoiceCode ? (
              <View style={s.footRow}>
                <Text style={s.note}>Paystack invoice</Text>
                <Text style={s.mono}>{view.paystackInvoiceCode}</Text>
              </View>
            ) : null}
            <Text style={s.note}>{view.referenceNote}</Text>
          </View>
        ) : null}

        <Text
          fixed
          render={({ pageNumber, totalPages }) =>
            `${view.number ?? view.title}  ·  Page ${pageNumber} of ${totalPages}`
          }
          style={s.pageFoot}
        />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Buffer> {
  await registerFonts();
  return renderToBuffer(<InvoicePdf view={invoiceView(doc)} />);
}
