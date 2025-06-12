import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import invoiceRoutes from "./routes/invoiceRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ✅ IMPORTANTE: primero auth
app.use("/api", authRoutes);

// Luego invoices
app.use("/api", invoiceRoutes);

app.get("/", (req, res) => {
  res.send("Servidor Backend Facturas 🧾 funcionando correctamente!");
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});
