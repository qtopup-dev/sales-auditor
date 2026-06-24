import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const catalogRouter = Router();

// GET /api/catalog/products — active products for sales dropdowns
// No requireRole: all authenticated users need catalog data (D-04)
// $extends softDeleteFilter applies isActive: true automatically (D-06)
catalogRouter.get('/products', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { organizationId: 1 },
    orderBy: { name: 'asc' },
  });
  res.json(products.map((p) => ({ id: p.id, name: p.name, price: p.price.toFixed(2) })));
});

// GET /api/catalog/mops — active MOPs for sales dropdowns
// No requireRole: same reasoning as /products above
catalogRouter.get('/mops', async (_req, res) => {
  const mops = await prisma.mop.findMany({
    where: { organizationId: 1 },
    orderBy: { name: 'asc' },
  });
  res.json(mops.map((m) => ({ id: m.id, name: m.name })));
});
