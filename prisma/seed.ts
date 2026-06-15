import { PrismaClient } from "@prisma/client";
import { seedDb } from "../app/lib/seed";

const prisma = new PrismaClient();

async function main() {
  for (const store of seedDb.stores) {
    await prisma.store.upsert({
      where: { id: store.id },
      update: {
        name: store.name,
        retailerType: store.retailerType,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        placeId: store.placeId
      },
      create: {
        id: store.id,
        name: store.name,
        retailerType: store.retailerType,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        placeId: store.placeId,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt
      }
    });
  }

  for (const product of seedDb.products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        canonicalName: product.canonicalName,
        setName: product.setName,
        productType: product.productType,
        imageUrl: product.imageUrl,
        active: product.active
      },
      create: {
        id: product.id,
        canonicalName: product.canonicalName,
        setName: product.setName,
        productType: product.productType,
        imageUrl: product.imageUrl,
        active: product.active,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    });
  }

  for (const identifier of seedDb.productIdentifiers) {
    await prisma.productIdentifier.upsert({
      where: {
        type_value: {
          type: identifier.type,
          value: identifier.value
        }
      },
      update: {
        productId: identifier.productId,
        source: identifier.source
      },
      create: {
        id: identifier.id,
        productId: identifier.productId,
        type: identifier.type,
        value: identifier.value,
        source: identifier.source,
        createdAt: identifier.createdAt
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
