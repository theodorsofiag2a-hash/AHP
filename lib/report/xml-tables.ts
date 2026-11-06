function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cell(text: string, opts: { width: number; header?: boolean; align?: "left" | "center" }): string {
  const shading = opts.header ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' : "";
  const bold = opts.header ? "<w:b/>" : "";
  const jc = opts.align === "center" ? '<w:jc w:val="center"/>' : '<w:jc w:val="left"/>';
  const run = `<w:r><w:rPr>${bold}<w:sz w:val="16"/><w:lang w:val="pt-BR"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${opts.width}" w:type="dxa"/>${shading}</w:tcPr><w:p><w:pPr>${jc}</w:pPr>${run}</w:p></w:tc>`;
}

/**
 * Tabela simples no mesmo estilo das do modelo (Tabelacomgrade, cabeçalho D9E2F3), para o docxtemplater
 * inserir como XML cru ({@tag}). `widths` em dxa (1/20 de ponto); a página útil tem ~9400.
 */
export function simpleTableXml(headers: string[], rows: string[][], widths: number[]): string {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers
    .map((h, i) => cell(h, { width: widths[i], header: true, align: i === 0 ? "left" : "center" }))
    .join("")}</w:tr>`;
  const body = rows
    .map(
      (r) =>
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r
          .map((c, i) => cell(c, { width: widths[i], align: i === 0 ? "left" : "center" }))
          .join("")}</w:tr>`
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabelacomgrade"/><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${head}${body}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
}
