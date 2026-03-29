const { applyGatewayPaymentResult } = require("../services/paymentGatewayService");

/**
 * Bước 6–7 use case: Payment Gateway gọi ngược (IPN / webhook).
 * Bảo vệ tùy chọn: đặt PAYMENT_GATEWAY_WEBHOOK_SECRET và gửi header X-Gateway-Secret.
 */
async function paymentGateway(req, res) {
    const secret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
    if (secret && String(secret).trim() !== "") {
        const sent = req.headers["x-gateway-secret"];
        if (sent !== secret) {
            return res.status(401).json({ message: "Unauthorized webhook" });
        }
    }

    const { reference, status } = req.body || {};
    if (!reference) {
        return res.status(400).json({ message: "reference là bắt buộc" });
    }
    const st = status != null ? String(status).toLowerCase() : "";
    if (st !== "success" && st !== "failed") {
        return res.status(400).json({ message: 'status phải là "success" hoặc "failed"' });
    }

    try {
        const out = await applyGatewayPaymentResult({
            reference: String(reference).trim(),
            success: st === "success"
        });
        return res.json({
            ok: true,
            idempotent: out.idempotent === true,
            order_id: out.order?.order_id != null ? String(out.order.order_id) : undefined,
            payment_status: out.payment?.payment_status,
            order_payment_status: out.order?.payment_status
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ message: e.message || "Webhook error" });
    }
}

module.exports = { paymentGateway };
