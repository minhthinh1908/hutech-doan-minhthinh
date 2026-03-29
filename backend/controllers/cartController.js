const prisma = require("../prisma/client");
const { effectiveUnitPrice } = require("../utils/productPrice");

async function getOrCreateCart(user_id) {
    const existing = await prisma.cart.findUnique({ where: { user_id } });
    if (existing) return existing;
    return prisma.cart.create({ data: { user_id } });
}

async function getMyCart(req, res) {
    const user_id = BigInt(req.user.user_id);
    const cart = await prisma.cart.findUnique({
        where: { user_id },
        include: {
            cart_items: {
                include: { product: true },
                orderBy: { cart_item_id: "desc" }
            }
        }
    });
    if (!cart) return res.json({ cart: null, items: [] });
    return res.json({
        cart: { ...cart, cart_id: cart.cart_id.toString(), user_id: cart.user_id.toString() },
        items: cart.cart_items.map((i) => ({
            ...i,
            cart_item_id: i.cart_item_id.toString(),
            cart_id: i.cart_id.toString(),
            product_id: i.product_id.toString(),
            product: i.product
                ? {
                      ...i.product,
                      product_id: i.product.product_id.toString(),
                      category_id: i.product.category_id.toString(),
                      brand_id: i.product.brand_id.toString()
                  }
                : null
        }))
    });
}

async function addItem(req, res) {
    const user_id = BigInt(req.user.user_id);
    const { product_id, quantity } = req.body;
    if (!product_id) return res.status(400).json({ message: "product_id is required" });
    const qty = quantity == null ? 1 : Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ message: "quantity must be >= 1" });
    }

    const product = await prisma.product.findUnique({
        where: { product_id: BigInt(product_id) }
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.status !== "active") return res.status(400).json({ message: "Product inactive" });

    const cart = await getOrCreateCart(user_id);

    const existing = await prisma.cartItem.findFirst({
        where: { cart_id: cart.cart_id, product_id: product.product_id }
    });

    const unit = effectiveUnitPrice(product);

    const item = existing
        ? await prisma.cartItem.update({
              where: { cart_item_id: existing.cart_item_id },
              data: { quantity: existing.quantity + qty, unit_price: unit }
          })
        : await prisma.cartItem.create({
              data: {
                  cart_id: cart.cart_id,
                  product_id: product.product_id,
                  quantity: qty,
                  unit_price: unit
              }
          });

    return res.status(201).json({
        ...item,
        cart_item_id: item.cart_item_id.toString(),
        cart_id: item.cart_id.toString(),
        product_id: item.product_id.toString()
    });
}

async function updateItem(req, res) {
    const user_id = BigInt(req.user.user_id);
    const id = BigInt(req.params.cart_item_id);
    const { quantity } = req.body;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ message: "quantity must be >= 1" });
    }

    const cart = await prisma.cart.findUnique({ where: { user_id } });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
    const item = await prisma.cartItem.findUnique({ where: { cart_item_id: id } });
    if (!item || item.cart_id !== cart.cart_id) {
        return res.status(404).json({ message: "Cart item not found" });
    }
    const updated = await prisma.cartItem.update({
        where: { cart_item_id: id },
        data: { quantity: qty }
    });
    return res.json({
        ...updated,
        cart_item_id: updated.cart_item_id.toString(),
        cart_id: updated.cart_id.toString(),
        product_id: updated.product_id.toString()
    });
}

async function removeItem(req, res) {
    const user_id = BigInt(req.user.user_id);
    const id = BigInt(req.params.cart_item_id);
    const cart = await prisma.cart.findUnique({ where: { user_id } });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
    const item = await prisma.cartItem.findUnique({ where: { cart_item_id: id } });
    if (!item || item.cart_id !== cart.cart_id) {
        return res.status(404).json({ message: "Cart item not found" });
    }
    await prisma.cartItem.delete({ where: { cart_item_id: id } });
    return res.json({ message: "Cart item deleted" });
}

module.exports = { getMyCart, addItem, updateItem, removeItem };

