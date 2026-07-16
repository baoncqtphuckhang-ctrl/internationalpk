# Nhật Ký Sửa Đổi & Khắc Phục Lỗi (Ngày 16/07/2026)

Tài liệu này lưu lại tất cả các yêu cầu sửa đổi giao diện và sửa lỗi (bug fixes) đã được thực hiện trong ngày hôm nay cho phân hệ **Đơn Đặt Hàng Vật Tư** (`MaterialOrder.jsx`).

---

### 1. Khắc Phục Lỗi Hệ Thống (Bug Fixes)
- **Lỗi Crash trang khi mở Đơn vật tư**: Sửa lỗi `ReferenceError: Cannot access 'formData' before initialization` (do gọi danh sách CHT trước khi Form sẵn sàng).
- **Lỗi thiếu icon ẩn/hiện**: Sửa lỗi crash `ReferenceError: EyeOff is not defined` và `Eye is not defined` bằng cách thêm import đầy đủ từ thư viện `lucide-react`.
- **Lỗi mất tên Người lập phiếu khi in**: Khắc phục việc tên người lập/ký ở cuối trang bị mất hoặc đẩy sang trang 2 do vượt quá chiều cao trang in. Đã đổi lề trang in thành `10mm 12mm` và thiết lập chiều cao in co giãn thông minh (`min-height: 265mm`).

---

### 2. Cập Nhật Form Lập Đơn & Logic Mặc Định
- **Tự động điền Người nhận hàng**: Khi chọn dự án, người nhận hàng thực tế sẽ tự động điền tên của **Chỉ huy trưởng (CHT) đầu tiên** kèm SĐT (nếu có).
- **Hạng mục thi công**:
  - Chuyển từ ô nhập tay thành **Dropdown**.
  - Mặc định chọn ngay **SƠN NƯỚC (SN)**.
  - Có các tùy chọn nhanh: `SƠN NƯỚC (SN)`, `THẠCH CAO (TC)` và `Khác (Nhập tay)...` (khi chọn Khác sẽ hiện ô nhập văn bản tự do).
- **Công ty đặt hàng (Yêu cầu bắt buộc)**:
  - Thêm ô chọn **Công ty đặt hàng** dạng Dropdown và đặt thuộc tính bắt buộc (`required`).
  - Mặc định chọn ngay **`CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG`**.
  - Có thêm tùy chọn nhanh: `CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK` và `Khác (Nhập tay)...` (hiện ô gõ tay nếu chọn).
  - *Lưu ý kỹ thuật*: Dữ liệu này được nhúng an toàn bên trong cột JSONB `items` của bảng để đảm bảo tương thích ngược 100% với cơ sở dữ liệu hiện tại, không gây lỗi hệ thống.

---

### 3. Tối Ưu Bản Xem Trước & Giao Diện In (Print Preview Modal)
- **Hiển thị dạng Modal nổi bật**: Khi click xem chi tiết/in phiếu, màn hình preview sẽ hiển thị dạng một cửa sổ Modal lớn nổi bật ở giữa, xung quanh được làm mờ đi (`backdrop-blur-sm bg-black/60`).
- **Nâng rộng giao diện xem trước**: Tăng chiều rộng xem trước lên tối đa `1050px` (bản in giả lập `950px` tỷ lệ dọc A4) giúp bảng vật tư hiển thị rộng rãi, không bị co cụm cột khi hiển thị đơn giá/thành tiền.
- **Thêm nhãn Nhà cung cấp**: Hiện rõ **`NHÀ CUNG CẤP : [Tên NCC]`** thay vì chỉ in dòng chữ trần như trước.
- **Hiện rõ Công ty đặt hàng**: Hiện rõ **`CÔNG TY ĐẶT HÀNG : [Tên công ty]`** trên tiêu đề phiếu in.
- **Bộ lọc in thông minh (Ngay trên thanh điều khiển)**:
  - **Tùy chọn ẩn giá & tiền**: Cho phép ẩn nhanh 2 cột Đơn giá & Thành tiền trước khi in.
  - **Tùy chọn chỉ in hàng có đặt**: Tự động lọc ẩn hoàn toàn các mặt hàng có số lượng bằng `0` hoặc bỏ trống để tiết kiệm giấy in.
- **Ép chuẩn khổ dọc A4**: Cấu hình mã CSS in đặc biệt ép buộc máy in xuất ra khổ **A4 dọc (Portrait)**.

---

### 4. Đồng Bộ Hóa Code (Git)
- Toàn bộ thay đổi trên đã được gom và commit cục bộ (Local Commit) trên máy của bạn với thông điệp:
  `feat: add ordering company dropdown, fix print preview and supplier fields`
- Khi bạn cần đẩy code lên GitHub, chỉ cần mở Terminal trên máy và gõ lệnh:
  `git push origin main`
