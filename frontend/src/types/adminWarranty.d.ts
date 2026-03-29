/**
 * Payload phẳng GET/PATCH `/api/admin/warranties` — đủ trường cho màn Admin → Bảo hành.
 */
export type AdminWarrantyItem = {
  warranty_id: number | string;
  order_item_id: number | string;
  order_id?: number | string;
  order_code?: string;

  user_id: number | string;
  user_name: string;
  user_email?: string;
  user_phone?: string;

  product_id: number | string;
  product_name: string;
  product_sku?: string;
  product_image?: string;

  warranty_code?: string;
  warranty_months?: number;

  start_date: string;
  end_date: string;
  status: "active" | "expired" | "claimed" | "void" | "pending";

  /** Ngày giao hàng (khi backend có dữ liệu đơn) */
  delivered_at?: string;
  repair_request_count?: number;
  latest_repair_status?: string;

  admin_note?: string;
  is_expired?: boolean;
  days_remaining?: number;

  activated_at?: string;
  created_at?: string;
  updated_at?: string;
};
