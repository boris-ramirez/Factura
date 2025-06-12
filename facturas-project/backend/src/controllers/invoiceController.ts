import { Request, Response } from "express";
import { createInvoice, getInvoiceById, getInvoicesByUserId } from "../services/invoiceService";
import OpenAI from "openai";

// Para extender el tipo de Request con userId
interface AuthRequest extends Request {
  userId?: number;
}

// ✅ Crear factura manualmente
export const uploadInvoice = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId, imageUrl, total, date, place, products } = req.body;

    const invoice = await createInvoice({
      userId,
      imageUrl,
      total,
      date,
      place,
      products,
    });

    return res.status(201).json({ message: "Factura creada exitosamente", invoice });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al crear factura" });
  }
};

// ✅ Obtener todas las facturas del usuario autenticado
export const listInvoices = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const invoices = await getInvoicesByUserId(userId);
    return res.json(invoices);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al listar facturas" });
  }
};

// ✅ Obtener una factura por ID
export const getInvoice = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const invoice = await getInvoiceById(Number(id));

    if (!invoice) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    return res.json(invoice);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener factura" });
  }
};

// ✅ Extraer datos desde imagen con OpenAI y crear factura
export const extractInvoiceFromImage = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { imageUrl, imageKey } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const basePrompt = `
Eres un sistema de extracción de datos de facturas. Devuelve SOLO un JSON válido. Sin explicaciones, sin saltos, sin markdown (\`\`\`), sin texto adicional.

El JSON debe tener esta estructura exacta:

{
  "total": number,
  "date": "YYYY-MM-DD",
  "place": "string",
  "products": [
    { "name": "string", "quantity": number, "price": number }
  ]
}

Si falta algún dato, usa null o 0.
`;

    const initialResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Eres un extractor de facturas." },
        {
          role: "user",
          content: [
            { type: "text", text: basePrompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = initialResponse.choices[0].message.content?.trim() || "";
    let parsed: any;

    try {
      parsed = JSON.parse(content);
    } catch {
      const fixPrompt = `
Corrige y convierte este texto en JSON válido con esta estructura:

{
  "total": number,
  "date": "YYYY-MM-DD",
  "place": "string",
  "products": [
    { "name": "string", "quantity": number, "price": number }
  ]
}

Texto original:
${content}
`;

      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: fixPrompt }],
        max_tokens: 800,
      });

      const cleaned = retry.choices[0].message.content?.trim() || "";

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("❌ JSON inválido tras limpieza:", cleaned);
        return res.status(400).json({
          message: "No se pudo convertir la respuesta en JSON válido",
          original: content,
          cleaned,
        });
      }
    }

    const factura = await createInvoice({
      userId,
      imageUrl,
      imageKey,
      total: parsed.total,
      date: parsed.date,
      place: parsed.place,
      products: parsed.products,
    });

    return res.json({ message: "Factura procesada y guardada", factura });
  } catch (error) {
    console.error("❌ Error en extractInvoiceFromImage:", error);
    return res.status(500).json({ message: "Error al procesar factura con OpenAI" });
  }
};
