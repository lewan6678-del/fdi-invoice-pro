/** Danh mục module mở rộng. status: "done" = đã có backend; "dev" = đang phát triển (không có nút giả). */
export interface ModuleInfo {
  slug: string;
  title: string;
  status: "done" | "dev";
  description: string;
  plan: string[];
  dependsOn?: string;
}

export const MODULES: ModuleInfo[] = [
  { slug: "risk-alerts", title: "Cảnh báo rủi ro", status: "dev", description: "Cảnh báo người bán rủi ro, MST ngừng hoạt động, hóa đơn sai lệch tổng tiền/thuế, hóa đơn bất thường.", plan: ["Bảng risk_rules & risk_findings theo company_id", "Bộ quy tắc chạy sau mỗi lượt import (dùng chung hàng đợi nền)", "Tra cứu trạng thái MST qua API cơ quan thuế (cần cấp quyền)"], dependsOn: "Phase 02 – dữ liệu hóa đơn" },
  { slug: "validity", title: "Phân loại hiệu lực", status: "dev", description: "Tự động phân loại hóa đơn: hiệu lực, bị thay thế, bị điều chỉnh, đã hủy, đủ điều kiện khấu trừ.", plan: ["Đã có trường status + quan hệ điều chỉnh/thay thế trong DB", "Bổ sung quy tắc khấu trừ (thanh toán không dùng tiền mặt ≥ 20 triệu…)", "Màn hình duyệt & ghi chú phân loại"], dependsOn: "Quan hệ hóa đơn (đã hoạt động)" },
  { slug: "vat-return", title: "Tờ khai thuế GTGT (01/GTGT)", status: "dev", description: "Lập tờ khai 01/GTGT theo tháng/quý từ dữ liệu hóa đơn mua vào/bán ra; xuất XML HTKK.", plan: ["Bảng vat_returns (company_id, kỳ, chỉ tiêu [21]…[43] dạng numeric)", "Tổng hợp theo thuế suất từ invoice_tax_summaries", "Xuất XML theo định dạng HTKK"] },
  { slug: "tax-reduction", title: "Phụ lục giảm thuế GTGT", status: "dev", description: "Lập phụ lục giảm thuế GTGT (8%) theo nghị định hiện hành từ dòng hàng bán ra.", plan: ["Tận dụng invoice_lines.tax_rate = 8%", "Mẫu phụ lục theo nghị định giảm thuế", "Xuất Excel/XML"] },
  { slug: "purchase-sale-ledger", title: "Bảng kê mua vào / bán ra", status: "dev", description: "Bảng kê theo mẫu chuẩn kế toán. Hiện đã có xuất Excel danh sách hóa đơn + chi tiết hàng hóa tại màn hình Hóa đơn.", plan: ["Mẫu bảng kê chuẩn theo thông tư", "Nhóm theo thuế suất, chữ ký người lập"] },
  { slug: "misa", title: "Xuất MISA Offline", status: "dev", description: "Xuất file Excel đúng mẫu nhập khẩu chứng từ mua hàng/bán hàng của MISA SME.", plan: ["Bảng mapping mã hàng/tài khoản theo công ty", "Mẫu Excel import MISA", "Đối chiếu danh mục khách hàng/nhà cung cấp"] },
  { slug: "erp-reconcile", title: "Đối chiếu ERP", status: "dev", description: "Đối chiếu hóa đơn với dữ liệu ERP (SAP/Oracle/…) của tập đoàn FDI.", plan: ["Nhập dữ liệu ERP qua Excel/CSV/API", "Đối chiếu theo số HĐ, MST, số tiền", "Báo cáo chênh lệch"] },
  { slug: "fdi-admin", title: "Quản trị FDI", status: "dev", description: "Báo cáo hợp nhất nhiều pháp nhân, tỷ giá, báo cáo song ngữ cho công ty mẹ.", plan: ["Nhóm công ty (group) trên bảng companies", "Báo cáo song ngữ Việt–Anh", "Quy đổi ngoại tệ theo exchange_rate"] },
  { slug: "ai-assistant", title: "Trợ lý AI kế toán", status: "dev", description: "Hỏi đáp dữ liệu hóa đơn, gợi ý hạch toán, giải thích lỗi XML.", plan: ["Chỉ truy vấn dữ liệu trong phạm vi company_id của người dùng", "Cần cấu hình khóa API mô hình AI", "Ghi audit log mọi câu hỏi"] },
];
