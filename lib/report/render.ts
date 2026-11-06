import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/** Onde cada gráfico entra no modelo Word (imagens de exemplo que o modelo traz e que são trocadas). */
export const TEMPLATE_IMAGE_SLOTS = {
  weights: "word/media/image1.png",
  radar: "word/media/image2.png",
  composition: "word/media/image3.png",
} as const;

export function renderReport(
  template: Buffer,
  data: Record<string, unknown>,
  images: { weights: Buffer; radar: Buffer; composition: Buffer }
): Buffer {
  const zip = new PizZip(template);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Marcador sem dado vira vazio em vez de "undefined".
    nullGetter: () => "",
  });
  doc.render(data);

  const out = doc.getZip();
  (Object.keys(TEMPLATE_IMAGE_SLOTS) as (keyof typeof TEMPLATE_IMAGE_SLOTS)[]).forEach((key) => {
    out.file(TEMPLATE_IMAGE_SLOTS[key], images[key]);
  });
  return out.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
