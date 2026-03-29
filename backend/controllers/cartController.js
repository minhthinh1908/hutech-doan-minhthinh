const prisma = require("../prisma/client");
const { effectiveUnitPrice } = require("../utils/productPrice");

async function getOrCreateCart(user_id) {
    const existing = await prisma.cart.findUnique({ where: { user_id } });
    if (existing) return existing;
    return prisma.cart.create({ data: { user_id } });
}

const productIncludeCart = {
    category: { include: { parent: true } },
    brand: true
};

function serializeCartProduct(p) {
    if (!p) return null;
    const { category, brand, ...rest } = p;
    const cat = category
        ? {
              ...category,
              category_id: category.category_id.toString(),
              parent_id: category.parent_id != null ? category.parent_id.toString() : null,
              parent: category.parent
                  ? {
                        ...category.parent,
                        category_id: category.parent.category_id.toString(),
                        parent_id:
                            category.parent.parent_id != null
                                ? category.parent.parent_id.toString()
                                : null
                    }
                  : null
          }
        : null;
    const br = brand
        ? { ...brand, brand_id: brand.brand_id.toString() }
        : null;
    return {
        ...rest,
        product_id: p.product_id.toString(),
        category_id: p.category_id.toString(),
        brand_id: p.brand_id.toString(),
        category: cat,
        brand: br
    };
}

async function getMyCart(req, res) {
    const user_id = BigInt(req.user.user_id);
    const cart = await prisma.cart.findUnique({
        where: { user_id },
        include: {
            cart_items: {
                include: { product: { include: productIncludeCart } },
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
            product: serializeCartProduct(i.product)
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
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    if (product.status !== "active") {
        return res.status(400).json({ message: "Sản phẩm đã ngừng kinh doanh — không thể thêm vào giỏ" });
    }

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
    const item = await prisma.cartItem.findUnique({
        where: { cart_item_id: id },
        include: { product: true }
    });
    if (!item || item.cart_id !== cart.cart_id) {
        return res.status(404).json({ message: "Cart item not found" });
    }
    const product = item.product;
    if (!product) return res.status(400).json({ message: "Sản phẩm không còn tồn tại" });
    if (product.status !== "active") {
        if (qty >= item.quantity) {
            return res.status(400).json({
                message:
                    "Sản phẩm đã ngừng kinh doanh — chỉ có thể giảm số lượng hoặc xóa khỏi giỏ"
            });
        }
    } else if (product.stock_quantity < qty) {
        return res.status(400).json({ message: "Số lượng vượt quá tồn kho" });
    }
    const unit = effectiveUnitPrice(product);
    const updated = await prisma.cartItem.update({
        where: { cart_item_id: id },
        data: { quantity: qty, unit_price: unit }
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

