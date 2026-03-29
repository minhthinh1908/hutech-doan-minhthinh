/**
 * Banner trang chủ: mỗi hãng có nhiều "slide", mỗi slide = 1 ảnh lớn + 2 ảnh phụ (cùng hãng).
 * Luồng tự động: lần lượt các slide trong hãng A → chuyển sang hãng B → …
 *
 * Ảnh DeWalt: import qua Vite (đường dẫn /public/... dễ 404 nếu thiếu file sau khi clone).
 */
/** Ảnh lớn cố định: DCD710D2 10.8V (kèm 2 pin + sạc) */
import dewaltMain from "../assets/brand-showcase/dewalt-main.png";
import dewaltSide806 from "../assets/brand-showcase/dewalt-side-806.png";
import dewaltSideTop from "../assets/brand-showcase/dewalt-side-top.png";
import dewaltSideBottom from "../assets/brand-showcase/dewalt-side-bottom.png";

export const BRAND_SHOWCASES = [
  {
    id: "dewalt",
    label: "DeWalt",
    slides: [
      {
        id: "d1",
        main: {
          image: dewaltMain,
          brand: "DEWALT",
          kicker: "10.8V XR · Kèm 02 pin + sạc",
          title: "Máy khoan cầm tay Dewalt DCD710D2 10.8V (kèm 2 pin)",
          price: "2.330.000đ",
          badges: ["10.8V", "XR", "BRUSHLESS"]
        },
        side1: {
          image: dewaltSideTop,
          kicker: "DCD709D1 · 20V MAX BL",
          title:
            "Máy khoan cầm tay Dewalt DCD709D1 (kèm 1 pin 2.0Ah + sạc)",
          price: "3.280.000đ"
        },
        side2: {
          image: dewaltSideBottom,
          kicker: "DCD791P1 · 18V XR",
          title:
            "Máy khoan cầm tay Dewalt DCD791P1 (kèm 01 pin 5.0Ah + sạc)",
          price: "3.990.000đ"
        }
      },
      {
        id: "d2",
        main: {
          image: dewaltMain,
          brand: "DEWALT",
          kicker: "10.8V XR LI-ION · Bộ đủ phụ kiện",
          title:
            "Máy khoan cầm tay Dewalt DCD710D2 — Gọn nhẹ, đủ cho xưởng & gia đình",
          price: "2.330.000đ",
          badges: ["10.8V", "XR", "LI-ION"]
        },
        side1: {
          image: dewaltSide806,
          kicker: "DCD806P2 · 20V MAX",
          title:
            "Máy khoan động lực Dewalt DCD806P2 (02 pin 5.0Ah + sạc)",
          price: "6.560.000đ"
        },
        side2: {
          image: dewaltSideTop,
          kicker: "DCD709D1 · 20V MAX BL",
          title:
            "Máy khoan cầm tay Dewalt DCD709D1 (1 pin 2.0Ah + sạc)",
          price: "3.280.000đ"
        }
      }
    ]
  },
  {
    id: "milwaukee",
    label: "Milwaukee",
    slides: [
      {
        id: "m1",
        main: {
          image:
            "https://images.unsplash.com/photo-1581147036324-c47a03d2bf32?w=1400&h=788&fit=crop&q=85",
          brand: "MILWAUKEE",
          kicker: "M18 FUEL · HEAVY DUTY",
          title: "Máy khoan pin M18 — Hiệu năng cao công trình",
          price: "4.200.000đ",
          badges: ["M18", "FUEL", "HD"]
        },
        side1: {
          image:
            "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&h=320&fit=crop&q=85",
          kicker: "M12 · COMPACT",
          title: "Dòng máy gọn nhẹ"
        },
        side2: {
          image:
            "https://images.unsplash.com/photo-1572981779307-38b8cabb2408?w=600&h=320&fit=crop&q=85",
          warranty: "BẢO HÀNH CHÍNH HÃNG"
        }
      },
      {
        id: "m2",
        main: {
          image:
            "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1400&h=788&fit=crop&q=85",
          brand: "MILWAUKEE",
          kicker: "REDLITHIUM",
          title: "Pin & sạc Milwaukee — Đồng bộ hệ M18",
          price: "Xem tại cửa hàng",
          badges: ["PIN", "SẠC", "PRO"]
        },
        side1: {
          image:
            "https://images.unsplash.com/photo-1581147036324-c47a03d2bf32?w=600&h=320&fit=crop&q=85",
          kicker: "M18",
          title: "Phụ kiện đồng bộ"
        },
        side2: {
          image:
            "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&h=320&fit=crop&q=85",
          warranty: "ĐỔI TRẢ 7 NGÀY"
        }
      }
    ]
  },
  {
    id: "stanley",
    label: "Stanley",
    slides: [
      {
        id: "s1",
        main: {
          image:
            "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1400&h=788&fit=crop&q=85",
          brand: "STANLEY",
          kicker: "PROFESSIONAL",
          title: "Dụng cụ đo & tay vặn Stanley — Bền bỉ công trường",
          price: "Từ 290.000đ",
          badges: ["PRO", "CHUẨN", "BỀN"]
        },
        side1: {
          image:
            "https://images.unsplash.com/photo-1581147036324-c47a03d2bf32?w=600&h=320&fit=crop&q=85",
          kicker: "FATMAX",
          title: "Thước & cưa tay"
        },
        side2: {
          image:
            "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&h=320&fit=crop&q=85",
          warranty: "HẬU MÃI TẠI CHỖ"
        }
      }
    ]
  }
];

export function buildHeroSequence() {
  const seq = [];
  BRAND_SHOWCASES.forEach((brand) => {
    brand.slides.forEach((slide) => {
      seq.push({
        brand,
        slide,
        key: `${brand.id}-${slide.id}`
      });
    });
  });
  return seq;
}
