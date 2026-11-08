# Báo cáo kiểm thử – FDI Invoice & Tax Automation Pro

Ngày chạy: 08/11/2026 · Môi trường: Claude Code Cloud (Linux, Node 22, PostgreSQL 16, Chromium)

## Tóm tắt

| Bộ kiểm thử | Kết quả |
|---|---|
| Unit + Integration (Vitest, PostgreSQL thật) – lưu file trên ổ đĩa | **36/36 đạt** |
| Unit + Integration – lưu file trong database (gói miễn phí, `STORAGE_DRIVER=db`) | **36/36 đạt** |
| E2E với `STORAGE_DRIVER=db` | **14/14 đạt** |
| Script khởi động production trên DB trống (migrate + tạo admin + đăng nhập) | **Đạt** |
| E2E trình duyệt (Playwright, bản build production) | **14/14 đạt** |
| Build production (`next build`) | **Thành công** |
| Kiểm tra kiểu TypeScript (`tsc --noEmit`) | **Không lỗi** |
| Build image Docker | **Chưa chạy được** – Docker Hub trả lỗi 429 (giới hạn lượt tải) trong phiên cloud |

Dữ liệu kiểm thử: **hoàn toàn tổng hợp** do `tests/fixtures/build-invoice.ts` sinh ra (MST giả, tên “dữ liệu mẫu”). Không sử dụng hóa đơn thật.

Kiểm thử chỉ chạy trên database có tên chứa `test` (`fdi_test`, `fdi_e2e_test`) – có chốt chặn trong mã để không thể chạy nhầm vào dữ liệu thật.

## Đối chiếu yêu cầu kiểm thử

| Yêu cầu | Test tương ứng | Kết quả |
|---|---|---|
| Tạo/sửa công ty | integration: *System Admin tạo công ty…*, *sửa công ty và ngừng hoạt động…*; E2E: *tạo công ty qua giao diện* | ✅ |
| Phân quyền người dùng | integration: *Editor không sửa được công ty…*, *Company Admin không thể tạo System Admin*, *Viewer không được upload*; E2E: *Viewer không được nhập hóa đơn* | ✅ |
| Hai MST không truy cập dữ liệu nhau | integration: nhóm *Cô lập dữ liệu giữa hai MST* (4 test); E2E: *Kế toán Beta không truy cập được dữ liệu Alpha* | ✅ |
| Upload XML hợp lệ | integration + E2E | ✅ |
| XML nhiều dòng hàng | unit (25 dòng) + integration (16 dòng) | ✅ |
| XML nhiều thuế suất | unit (10/8/5/0%/KCT) + integration + E2E | ✅ |
| XML sai cấu trúc | unit + integration + E2E (file hỏng trong ZIP) | ✅ |
| ZIP nhiều file | integration (5 XML + PDF + file lỗi + file lạ) + E2E | ✅ |
| Upload trùng | integration (cả khi số HĐ có số 0 ở đầu) + E2E | ✅ |
| Lưu dữ liệu sau khi đăng nhập lại | integration + E2E | ✅ |
| Xuất dữ liệu không lẫn công ty | integration (đọc lại file Excel) + E2E (tải file qua HTTP) | ✅ |

## Chi tiết Unit + Integration (Vitest)

```
✓ tests/integration/companies-rbac.test.ts > Quản lý công ty > System Admin tạo công ty với MST, tên, địa chỉ, năm tài chính 15ms
✓ tests/integration/companies-rbac.test.ts > Quản lý công ty > từ chối MST không hợp lệ và MST trùng 11ms
✓ tests/integration/companies-rbac.test.ts > Quản lý công ty > sửa công ty và ngừng hoạt động / kích hoạt lại 16ms
✓ tests/integration/companies-rbac.test.ts > Quản lý công ty > Company Admin không thể đổi MST; chỉ System Admin tạo công ty 207ms
✓ tests/integration/companies-rbac.test.ts > Phân quyền người dùng > Editor không sửa được công ty, Viewer không có quyền quản trị thành viên 361ms
✓ tests/integration/companies-rbac.test.ts > Phân quyền người dùng > Company Admin tạo tài khoản mới gắn vào công ty và đổi vai trò 406ms
✓ tests/integration/companies-rbac.test.ts > Phân quyền người dùng > Company Admin không thể tạo System Admin 191ms
✓ tests/integration/companies-rbac.test.ts > Phân quyền người dùng > danh sách công ty chỉ gồm công ty được phân quyền 216ms
✓ tests/integration/companies-rbac.test.ts > Đăng nhập & phiên > đăng nhập đúng tạo phiên lưu trong DB; sai mật khẩu bị từ chối; đăng xuất xóa phiên 590ms
✓ tests/integration/companies-rbac.test.ts > Đăng nhập & phiên > tài khoản bị khóa không đăng nhập được 362ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > upload XML hợp lệ (bán ra) → lưu hóa đơn, dòng hàng, XML gốc bất biến 79ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > XML mua vào nhiều dòng hàng + nhiều thuế suất 53ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > XML sai cấu trúc → ghi nhận lỗi có hướng khắc phục, không tạo hóa đơn 37ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > XML của công ty khác (không khớp MST) bị từ chối 34ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > ZIP nhiều file: xử lý từng file độc lập, ghi nhận thành công/thất bại, ghép PDF 187ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > upload trùng → DUPLICATE, không tạo bản ghi mới, không ghi đè dữ liệu cũ 87ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > hóa đơn thay thế liên kết với hóa đơn gốc và đánh dấu gốc 'Bị thay thế' 50ms
✓ tests/integration/imports.test.ts > Nhập hóa đơn XML > Viewer không được upload 3ms
✓ tests/integration/imports.test.ts > Cô lập dữ liệu giữa hai MST (tenant isolation) > người dùng công ty A không đọc được danh sách/chi tiết/file/dashboard của công ty B 15ms
✓ tests/integration/imports.test.ts > Cô lập dữ liệu giữa hai MST (tenant isolation) > người dùng công ty A không thể upload vào công ty B 2ms
✓ tests/integration/imports.test.ts > Cô lập dữ liệu giữa hai MST (tenant isolation) > danh sách hóa đơn A chỉ chứa dữ liệu A 31ms
✓ tests/integration/imports.test.ts > Cô lập dữ liệu giữa hai MST (tenant isolation) > cùng một file XML được lưu riêng cho từng công ty (không dùng chung bản ghi file) 103ms
✓ tests/integration/imports.test.ts > Tìm kiếm theo kỳ & xuất Excel > lọc theo tháng, quý, năm 60ms
✓ tests/integration/imports.test.ts > Tìm kiếm theo kỳ & xuất Excel > xuất Excel chỉ có dữ liệu của công ty được chọn 124ms
✓ tests/integration/imports.test.ts > Dữ liệu bền vững > dữ liệu còn nguyên sau khi đăng xuất và đăng nhập lại 477ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > đọc thông tin chung, người bán, người mua 9ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > đọc nhiều dòng hàng 4ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > đọc nhiều thuế suất GTGT (10%, 8%, 5%, 0%, KCT) 2ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > xử lý namespace có tiền tố và hồ sơ bọc ngoài TDiep 3ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > đọc hóa đơn thay thế / điều chỉnh 2ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > giữ chính xác số thập phân lớn (Decimal, không làm tròn float) 1ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > báo lỗi XML sai cấu trúc kèm hướng khắc phục 1ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > báo lỗi XML không phải hóa đơn 1ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > báo lỗi thiếu trường bắt buộc 2ms
✓ tests/unit/parser.test.ts > Đọc XML hóa đơn TT78 > chuẩn hóa thuế suất 0ms
```

## Chi tiết E2E (Playwright – trình duyệt Chromium thật)

- ✅ Đăng nhập sai mật khẩu hiển thị lỗi kèm hướng khắc phục
- ✅ Chưa đăng nhập bị chuyển về trang đăng nhập
- ✅ System Admin đăng nhập, tạo công ty mới qua giao diện
- ✅ Tạo công ty trùng MST báo lỗi rõ ràng
- ✅ Kế toán Alpha: kéo thả XML + PDF + ZIP, thanh tiến trình, báo cáo từng file
- ✅ Tải lại cùng file → báo trùng, không tạo bản ghi mới
- ✅ Danh sách hóa đơn theo kỳ, mở modal xem chi tiết (hàng hóa, thuế, XML/PDF)
- ✅ Lọc mua vào & tìm kiếm
- ✅ Xuất Excel chỉ chứa dữ liệu công ty Alpha
- ✅ Đăng xuất, đăng nhập lại → dữ liệu còn nguyên
- ✅ Viewer Alpha: thấy dữ liệu nhưng không được nhập hóa đơn
- ✅ Kế toán Beta: không thấy và không truy cập được dữ liệu Alpha (tenant isolation)
- ✅ Dark mode bật/tắt
- ✅ Module chưa triển khai hiển thị 'Đang phát triển', không có nút thao tác giả

Ảnh chụp màn hình E2E: `test-results/screenshots/`.

## Cách chạy lại

```bash
npm test
npm run build && npm run test:e2e
```
