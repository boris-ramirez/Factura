import { Router, Request, Response } from "express";
import {
  uploadInvoice,
  listInvoices,
  getInvoice,
  extractInvoiceFromImage,
} from "../controllers/invoiceController";
import { upload } from "../utils/uploadToS3";
import prisma from "../prisma/client";
import { deleteFromS3 } from "../utils/deleteFromS3";
import { requireAuth } from "../../middleware/authMiddleware";

const router = Router();

// ✅ Subir imagen a S3
router.post("/invoices/upload-image", upload.single("image"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: "No se recibió ninguna imagen" });
    return;
  }
  const file = req.file as any;
  res.status(200).json({
    imageUrl: file.location,
    imageKey: file.key,
  });
});

// ✅ Crear factura
router.post("/invoices", requireAuth, async (req: Request, res: Response): Promise<void> => {
  await uploadInvoice(req as any, res);
});

// ✅ Listar facturas
router.get("/invoices", requireAuth, async (req: Request, res: Response): Promise<void> => {
  await listInvoices(req as any, res);
});

// ✅ Obtener una factura
router.get("/invoices/:id", async (req: Request, res: Response): Promise<void> => {
  await getInvoice(req, res);
});

// ✅ Extraer con OpenAI
router.post("/invoices/extract", requireAuth, async (req: Request, res: Response): Promise<void> => {
  await extractInvoiceFromImage(req as any, res);
});

// ✅ Editar factura
router.put("/invoices/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { date, place, products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      res.status(400).json({ message: "Productos inválidos" });
      return;
    }

    const total = products.reduce((sum: number, p: any) => sum + p.quantity * p.price, 0);

    await prisma.product.deleteMany({ where: { invoiceId: id } });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        date: new Date(date),
        place,
        total,
        products: {
          create: products.map((p: any) => ({
            name: p.name,
            quantity: p.quantity,
            price: p.price,
          })),
        },
      },
      include: { products: true },
    });

    res.json({ message: "Factura actualizada", invoice: updated });
  } catch (err) {
    console.error("❌ Error actualizando:", err);
    res.status(500).json({ message: "Error al actualizar factura" });
  }
});

// ✅ Eliminar factura
router.delete("/invoices/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      res.status(404).json({ message: "Factura no encontrada" });
      return;
    }

    await prisma.product.deleteMany({ where: { invoiceId: id } });

    if (invoice.imageKey) {
      await deleteFromS3(invoice.imageKey);
    }

    await prisma.invoice.delete({ where: { id } });

    res.json({ message: "Factura eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando factura:", error);
    res.status(500).json({ message: "Error al eliminar factura" });
  }
});

export default router;
