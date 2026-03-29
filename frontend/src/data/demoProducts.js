/** Dữ liệu demo khi chưa có API / lỗi mạng — id trùng với mock để deep link /san-pham/:id */
export const DEMO_PRODUCTS = [
  {
    id: 1,
    name: "Máy vặn vít mini dùng pin M12 FUEL",
    price: 2600000,
    oldPrice: 2900000,
    discount: 10,
    hot: true,
    tag: "bestseller",
    brand: "milwaukee",
    image:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop"
  },
  {
    id: 2,
    name: "Máy khoan pin 18V XR Brushless",
    price: 2890000,
    oldPrice: 3590000,
    discount: 19,
    hot: true,
    tag: "bestseller",
    brand: "dewalt",
    image:
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2408?w=400&h=400&fit=crop"
  },
  {
    id: 3,
    name: "Bộ máy siết bu lông 1/2 inch",
    price: 4200000,
    oldPrice: 5200000,
    discount: 19,
    hot: true,
    tag: "bestseller",
    brand: "milwaukee",
    image:
      "https://images.unsplash.com/photo-1581147036324-c47a03d2bf32?w=400&h=400&fit=crop"
  },
  {
    id: 4,
    name: "Máy mài góc 125mm công suất cao",
    price: 1650000,
    oldPrice: 2100000,
    discount: 21,
    hot: false,
    tag: "bestseller",
    brand: "stanley",
    image:
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=400&fit=crop"
  },
  {
    id: 5,
    name: "Máy cắt kim loại dùng pin 20V",
    price: 0,
    oldPrice: null,
    discount: 0,
    hot: true,
    tag: "bestseller",
    brand: "worx",
    contactOnly: true,
    image:
      "https://images.unsplash.com/photo-1530124566582-e618495d2ea2?w=400&h=400&fit=crop"
  },
  {
    id: 6,
    name: "Thân máy bắn vít DCF 870 XR",
    price: 3500000,
    oldPrice: null,
    discount: 11,
    hot: true,
    tag: "new",
    brand: "dewalt",
    image:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop&q=80"
  },
  {
    id: 7,
    name: "Máy khoan bê tông SDS-Plus",
    price: 4500000,
    oldPrice: 5500000,
    discount: 18,
    hot: false,
    tag: "new",
    brand: "amax",
    image:
      "https://images.unsplash.com/photo-1565538810883-93b82c9fd267?w=400&h=400&fit=crop"
  },
  {
    id: 8,
    name: "Máy thổi pin 18V (thân máy)",
    price: 1890000,
    oldPrice: 2200000,
    discount: 14,
    hot: false,
    tag: "new",
    brand: "milwaukee",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=400&fit=crop"
  },
  {
    id: 9,
    name: "Máy siết bu lông M18 FUEL",
    price: 5200000,
    oldPrice: 6500000,
    discount: 20,
    hot: true,
    tag: "bestseller",
    brand: "milwaukee",
    image:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop"
  },
  {
    id: 10,
    name: "Máy cưa lọng pin 20V MAX",
    price: 3100000,
    oldPrice: null,
    discount: 15,
    hot: false,
    tag: "bestseller",
    brand: "dewalt",
    image:
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2408?w=400&h=400&fit=crop"
  },
  {
    id: 11,
    name: "Tuýp vặn ốc bộ 19 chi tiết",
    price: 890000,
    oldPrice: 1100000,
    discount: 19,
    hot: false,
    tag: "new",
    brand: "stanley",
    image:
      "https://images.unsplash.com/photo-1581244277942-a400989507e9?w=400&h=400&fit=crop"
  },
  {
    id: 12,
    name: "Máy phát điện mini công trình",
    price: 0,
    oldPrice: null,
    discount: 0,
    hot: false,
    tag: "bestseller",
    brand: "amax",
    contactOnly: true,
    image:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=400&fit=crop"
  }
];

export function findDemoProduct(id) {
  return DEMO_PRODUCTS.find((p) => String(p.id) === String(id));
}
