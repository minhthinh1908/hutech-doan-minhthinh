/**
 * 6 nhóm gốc + danh mục con — dùng cho seed và nút «Đồng bộ» trong admin.
 * Khớp menu mega (trái 6 dòng, phải 5 cột).
 */
const PARENTS = [
  "MÁY MÓC CẦM TAY",
  "PHỤ KIỆN",
  "VẬT LIỆU",
  "ĐỒ NGHỀ CẦM TAY",
  "BẢO QUẢN",
  "DỤNG CỤ ĐO LƯỜNG"
];

const SUBS = [
  [
    "Máy Bu Lông",
    "Máy Khoan Bê Tông",
    "Máy Bắn Vít",
    "Máy Hút Bụi Pin",
    "Đèn pin",
    "Pin + Sạc",
    "Máy Phay Pin",
    "Máy Mài Góc Pin",
    "Máy Cắt Pin",
    "Máy Chà Nhám",
    "Máy Mài Khuôn Pin",
    "Máy Bắn Đinh",
    "Máy Cắt Bê Tông Pin",
    "Máy Cắt Sắt Pin",
    "Máy Khò Nhiệt",
    "Máy Tra Mỡ",
    "Máy Bơm Hơi",
    "Máy Bào Gỗ Pin",
    "Máy cưa vòng",
    "Máy Hút Chân Không",
    "Máy Rút Đinh",
    "Máy Đánh Bóng",
    "Máy Chà Gỗ Pin",
    "Máy nén khí",
    "Máy Bơm Keo",
    "Máy Thổi Pin",
    "Máy Cưa Đĩa Pin",
    "Máy Cưa Sọc",
    "Máy cắt đa năng",
    "Máy Khoan Pin",
    "Máy Cân Mực",
    "Máy Cưa Kiếm",
    "Máy cưa xích"
  ],
  [
    "Mũi khoan mũi vít",
    "Mũi phay gỗ",
    "Búa",
    "Mũi khoan Makita",
    "Lục giác Nhật Bản",
    "Bút Điện Tử",
    "Mũi khoan bê tông",
    "Lục giác bông sao",
    "Mũi bắn vít",
    "Lục giác đầu bi",
    "Đĩa mài đĩa cắt",
    "Kìm"
  ],
  [
    "Dầu lau gỗ",
    "Lưỡi cưa lọng",
    "Giấy nhám",
    "Lưỡi cưa kiếm cắt rung",
    "Đĩa mài",
    "Lưỡi cắt gạch",
    "Keo",
    "Đá cắt",
    "Lưỡi cưa gỗ",
    "Khung cưa cầm tay"
  ],
  [
    "Kim Chết",
    "Bút Thử Điện",
    "Tua Vít",
    "Kim Cắt",
    "Công Cụ Vặn Siết",
    "Đo lường",
    "Cưa & Dụng Cụ Cắt",
    "Lục Giác",
    "Kẹp & Ê tô",
    "Đục gỗ",
    "Búa & Xà Beng"
  ],
  [
    "Găng tay",
    "Giày, ủng bảo hộ lao động",
    "Thùng đựng đồ nghề",
    "Túi đựng đồ nghề",
    "Tủ đựng đồ nghề",
    "Bộ Lưu Trữ"
  ],
  [
    "Thước Dây",
    "Thước ke góc",
    "Thước cuộn",
    "Thước Stanley",
    "Thước chuyên dụng",
    "Thước thủy",
    "Máy đo khoảng cách",
    "Thước thẳng",
    "Máy cân mực laser",
    "Thước cặp"
  ]
];

module.exports = { PARENTS, SUBS };
