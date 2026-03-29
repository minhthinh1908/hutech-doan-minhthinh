const prisma = require("../prisma/client");

/**
 * @param {object} opts
 * @param {import('@prisma/client').Prisma.TransactionClient} [opts.tx]
 * @param {bigint} opts.order_id
 * @param {bigint|null} [opts.payment_id]
 * @param {string|null} [opts.from_status]
 * @param {string} opts.to_status
 * @param {string} [opts.source] system | admin | buyer | gateway
 * @param {string|null} [opts.note]
 */
async function appendPaymentStatusLog({ tx, order_id, payment_id, from_status, to_status, source, note }) {
    const client = tx || prisma;
    return client.paymentStatusLog.create({
        data: {
            order_id,
            payment_id: payment_id ?? null,
            from_status: from_status ?? null,
            to_status,
            source: source || "system",
            note: note ?? null
        }
    });
}

module.exports = { appendPaymentStatusLog };
