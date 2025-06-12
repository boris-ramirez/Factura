import prisma from "../prisma/client";

export interface CreateInvoiceData {
  userId: number;
  imageUrl: string;
  imageKey?: string; // ✅ nuevo campo opcional
  total: number;
  date: string;
  place: string;
  products: {
    name: string;
    quantity: number;
    price: number;
  }[];
}


export const createInvoice = async (data: CreateInvoiceData) => {
  const { userId, imageUrl, total, date, place, products, imageKey } = data;

return prisma.invoice.create({
  data: {
    userId,
    imageUrl,
    imageKey, // 👈 nuevo campo
    total,
    date: new Date(date),
    place,
    products: {
      create: products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        price: product.price,
      })),
    },
  },
  include: {
    products: true,
  },
});

};

export const getInvoicesByUserId = async (userId: number) => {
  return prisma.invoice.findMany({
    where: { userId },
    include: { products: true },
  });
};

export const getInvoiceById = async (id: number) => {
  return prisma.invoice.findUnique({
    where: { id },
    include: { products: true },
  });
};
