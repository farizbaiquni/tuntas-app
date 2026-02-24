import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { BabCalk, JenisLaporan, LampiranUtama } from "@/app/_types/type";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DaftarIsiEntry {
  romawi: string;
  judul: string;
  nomorHalaman: number;
  isCALK: boolean;
  babs: BabCalk[];
}

// ─── Helper: Hitung nomor halaman awal tiap lampiran ─────────────────────────

/** Hitung jumlah halaman bernomor (non-CALK-skip) untuk satu lampiran */
function halamanBernomorOf(l: LampiranUtama): number {
  const totalPdf = l.jumlahHalaman || 0;
  const totalSkip = l.babs
    .flatMap((b) => b.lampiranCalk ?? [])
    .reduce((sum, lc) => {
      const skipped = lc.sampaiAkhir
        ? Math.max(0, totalPdf - lc.halamanMulai + 1)
        : lc.jumlahHalaman || 0;
      return sum + skipped;
    }, 0);
  return Math.max(0, totalPdf - totalSkip);
}

/**
 * Bangun DaftarIsiEntry[] dari array LampiranUtama yang sudah terurut.
 * nomorHalaman mengikuti penomoran footer — 1-based, hanya halaman bernomor.
 * Bab/subbab pada CALK: halamanMulai di BabCalk/SubbabCalk adalah halaman
 * RELATIF dalam PDF CALK, dikonversi ke nomor halaman absolut dokumen.
 */
export function buildDaftarIsiEntries(
  lampirans: LampiranUtama[],
): DaftarIsiEntry[] {
  const sorted = [...lampirans].sort((a, b) => a.urutan - b.urutan);
  let cursor = 1; // nomor halaman berjalan

  return sorted.map((l) => {
    const startPage = cursor;
    const bernomor = halamanBernomorOf(l);

    // Hitung skip ranges (halaman PDF relatif yang tidak bernomor)
    const totalPdf = l.jumlahHalaman || 0;
    const skipRanges = l.babs
      .flatMap((b) => b.lampiranCalk ?? [])
      .map((lc) => ({
        from: lc.halamanMulai,
        to: lc.sampaiAkhir ? totalPdf : lc.halamanMulai + lc.jumlahHalaman - 1,
      }));

    /**
     * Konversi halaman-PDF-relatif → nomor-halaman-dokumen.
     * Misal halamanMulai=5 di PDF, hitung berapa banyak halaman 1..5
     * yang tidak di-skip, tambahkan ke startPage.
     */
    const pdfToDocPage = (pdfPage: number): number => {
      let count = 0;
      for (let p = 1; p <= pdfPage; p++) {
        const skipped = skipRanges.some((r) => p >= r.from && p <= r.to);
        if (!skipped) count++;
      }
      return startPage + count - 1;
    };

    // Remapping babs dengan halamanMulai absolut
    const babsAbsolut: BabCalk[] = l.babs.map((bab) => ({
      ...bab,
      halamanMulai: pdfToDocPage(bab.halamanMulai),
      subbabs: bab.subbabs.map((sub) => ({
        ...sub,
        halamanMulai: pdfToDocPage(sub.halamanMulai),
      })),
    }));

    cursor += bernomor;

    return {
      romawi: l.romawiLampiran,
      judul: l.judulPembatasLampiran,
      nomorHalaman: startPage,
      isCALK: l.isCALK,
      babs: babsAbsolut,
    };
  });
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export async function generateDaftarIsi(
  jenisLaporan: JenisLaporan,
  tahun: number,
  nomor: number | null,
  entries: DaftarIsiEntry[],
  pdfDoc: PDFDocument,
): Promise<void> {
  // Dimensi: Legal (sama dengan cover/lampiran)
  const width = 609.6;
  const height = 935.6;
  const marginLeft = 70;
  const marginRight = 70;
  const bottomMargin = 80;

  let page = pdfDoc.addPage([width, height]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = page.getWidth();
  const usableWidth = pageWidth - marginLeft - marginRight;
  const centerX = pageWidth / 2;

  // ── Utility: word-wrap ──────────────────────────────────────────────────────

  function wrapText(
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number,
  ): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // ── Utility: drawCentered ───────────────────────────────────────────────────

  function drawCentered(
    pg: PDFPage,
    text: string,
    y: number,
    font: PDFFont,
    size = 12,
  ): number {
    const w = font.widthOfTextAtSize(text, size);
    pg.drawText(text, {
      x: centerX - w / 2,
      y,
      font,
      size,
      color: rgb(0, 0, 0),
    });
    return y - size - 6;
  }

  // ── Gambar satu entri lampiran (baris header + judul + nomor halaman + garis) ──

  function drawEntry(
    pg: PDFPage,
    entry: DaftarIsiEntry,
    startY: number,
  ): number {
    const fontSize = 11;
    const lineHeight = fontSize + 5;
    const rightColWidth = 50;
    const maxTextWidth = usableWidth - rightColWidth;

    // "LAMPIRAN [romawi] PERATURAN DAERAH KABUPATEN KENDAL"
    let jenisLabel = "PERATURAN DAERAH KABUPATEN KENDAL";
    if (
      jenisLaporan === JenisLaporan.RAPERBUP ||
      jenisLaporan === JenisLaporan.PERBUP ||
      jenisLaporan === JenisLaporan.SALINAN_PERBUP
    ) {
      jenisLabel = "PERATURAN BUPATI KENDAL";
    }
    const headerText = `LAMPIRAN ${entry.romawi} ${jenisLabel}`;
    const headerLines = wrapText(headerText, fontBold, fontSize, maxTextWidth);

    let y = startY - lineHeight;
    for (let i = 0; i < headerLines.length; i++) {
      pg.drawText(headerLines[i], {
        x: marginLeft,
        y: y - i * lineHeight,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }
    y -= headerLines.length * lineHeight;

    // Judul lampiran
    const titleLines = wrapText(
      entry.judul,
      fontRegular,
      fontSize,
      maxTextWidth,
    );
    for (let i = 0; i < titleLines.length; i++) {
      pg.drawText(titleLines[i], {
        x: marginLeft,
        y: y - i * lineHeight,
        size: fontSize,
        font: fontRegular,
        color: rgb(0, 0, 0),
      });
    }

    // Nomor halaman di baris terakhir judul
    const lastTitleY = y - (titleLines.length - 1) * lineHeight;
    const pageNumStr = entry.nomorHalaman.toString();
    const pageNumWidth = fontRegular.widthOfTextAtSize(pageNumStr, fontSize);
    pg.drawText(pageNumStr, {
      x: pageWidth - marginRight - pageNumWidth,
      y: lastTitleY,
      size: fontSize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // Garis pemisah
    const lineY = lastTitleY - 10;
    pg.drawLine({
      start: { x: marginLeft, y: lineY },
      end: { x: pageWidth - marginRight, y: lineY },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
    });

    return lineY - 14;
  }

  // ── Gambar isi CALK: bab + subbab ──────────────────────────────────────────

  function drawCALKSection(
    pg: PDFPage,
    babs: BabCalk[],
    startY: number,
  ): { y: number; pg: PDFPage } {
    let currentY = startY;
    let currentPage = pg;
    const fontSize = 11;
    const lineHeight = fontSize + 5;
    const babIndent = 10;
    const subIndent = 30;
    const rightColWidth = 50;

    function drawCalkEntry(
      text: string,
      pageNum: number,
      font: PDFFont,
      indent: number,
    ): void {
      if (currentY < bottomMargin) {
        currentPage = pdfDoc.addPage([width, height]);
        currentY = height - 80;
      }

      const maxTextWidth = usableWidth - rightColWidth - indent;
      const lines = wrapText(text, font, fontSize, maxTextWidth);

      for (let i = 0; i < lines.length; i++) {
        currentPage.drawText(lines[i], {
          x: marginLeft + indent,
          y: currentY - lineHeight * (i + 1),
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }

      const lastY = currentY - lineHeight * lines.length;

      // Nomor halaman
      const pnStr = pageNum.toString();
      const pnW = font.widthOfTextAtSize(pnStr, fontSize);
      currentPage.drawText(pnStr, {
        x: pageWidth - marginRight - pnW,
        y: lastY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      // Garis
      currentPage.drawLine({
        start: { x: marginLeft, y: lastY - 5 },
        end: { x: pageWidth - marginRight, y: lastY - 5 },
        thickness: 0.5,
        color: rgb(0.3, 0.3, 0.3),
      });

      currentY = lastY - 12;
    }

    for (const bab of babs) {
      if (currentY < bottomMargin) {
        currentPage = pdfDoc.addPage([width, height]);
        currentY = height - 80;
      }

      // Bab hanya ditampilkan untuk RAPERDA/PERDA
      if (
        jenisLaporan === JenisLaporan.RAPERDA ||
        jenisLaporan === JenisLaporan.PERDA ||
        jenisLaporan === JenisLaporan.SALINAN_PERDA
      ) {
        drawCalkEntry(
          `Bab ${bab.bab}  ${bab.judul}`,
          bab.halamanMulai,
          fontRegular,
          babIndent,
        );
      }

      for (const sub of bab.subbabs) {
        if (currentY < bottomMargin) {
          currentPage = pdfDoc.addPage([width, height]);
          currentY = height - 80;
        }
        const subPrefix =
          jenisLaporan === JenisLaporan.RAPERDA ||
          jenisLaporan === JenisLaporan.PERDA ||
          jenisLaporan === JenisLaporan.SALINAN_PERDA
            ? `${bab.bab}.${sub.subbab}  `
            : "";
        drawCalkEntry(
          `${subPrefix}${sub.judul}`,
          sub.halamanMulai,
          fontRegular,
          subIndent,
        );
      }
    }

    return { y: currentY, pg: currentPage };
  }

  // ── HEADER halaman pertama ──────────────────────────────────────────────────

  let currentY = height - 100;

  currentY = drawCentered(page, "PENUNJUK HALAMAN", currentY, fontBold, 13);

  let judulHeader = "LAMPIRAN RANCANGAN PERATURAN DAERAH KABUPATEN KENDAL";
  if (
    jenisLaporan === JenisLaporan.PERDA ||
    jenisLaporan === JenisLaporan.SALINAN_PERDA
  ) {
    judulHeader = "LAMPIRAN PERATURAN DAERAH KABUPATEN KENDAL";
  } else if (
    jenisLaporan === JenisLaporan.RAPERBUP ||
    jenisLaporan === JenisLaporan.PERBUP ||
    jenisLaporan === JenisLaporan.SALINAN_PERBUP
  ) {
    judulHeader = "LAMPIRAN RANCANGAN PERATURAN BUPATI KENDAL";
  }
  currentY = drawCentered(page, judulHeader, currentY, fontRegular, 11);

  const nomorLabel = nomor
    ? `NOMOR ${nomor} TAHUN ${tahun}`
    : `NOMOR ..... TAHUN ${tahun}`;
  currentY = drawCentered(page, nomorLabel, currentY, fontRegular, 11);

  // Garis tebal setelah header
  const headerLineY = currentY - 8;
  page.drawLine({
    start: { x: marginLeft, y: headerLineY },
    end: { x: pageWidth - marginRight, y: headerLineY },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });

  // Kolom "URAIAN" dan "HALAMAN"
  currentY = headerLineY - 20;
  page.drawText("URAIAN", {
    x: marginLeft,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  const halamanW = fontBold.widthOfTextAtSize("HALAMAN", 11);
  page.drawText("HALAMAN", {
    x: pageWidth - marginRight - halamanW,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  currentY -= 16;

  // Garis bawah kolom header
  page.drawLine({
    start: { x: marginLeft, y: currentY },
    end: { x: pageWidth - marginRight, y: currentY },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  currentY -= 20;

  // ── Loop tiap lampiran ──────────────────────────────────────────────────────

  for (const entry of entries) {
    if (currentY < bottomMargin) {
      page = pdfDoc.addPage([width, height]);
      // Kolom URAIAN/HALAMAN di halaman baru
      page.drawText("URAIAN", {
        x: marginLeft,
        y: height - 60,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      const hw = fontBold.widthOfTextAtSize("HALAMAN", 11);
      page.drawText("HALAMAN", {
        x: pageWidth - marginRight - hw,
        y: height - 60,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      page.drawLine({
        start: { x: marginLeft, y: height - 76 },
        end: { x: pageWidth - marginRight, y: height - 76 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      currentY = height - 100;
    }

    currentY = drawEntry(page, entry, currentY);

    if (entry.isCALK && entry.babs.length > 0) {
      const result = drawCALKSection(page, entry.babs, currentY);
      currentY = result.y;
      page = result.pg;
    }
  }
}
