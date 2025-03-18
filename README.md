# auction_web:NT208
course project of web application programming

# Cài đặt các gói cần thiết
 Chạy lệnh: pip install -r requirements.txt

# Hướng Dẫn Cài Đặt Cơ Sở Dữ Liệu Cho Dự Án Đấu Giá Trực Tuyến

## 1. Cài Đặt Cơ Sở Dữ Liệu

### 1.1. Yêu Cầu
- MySQL Server (phiên bản >= 5.7)
- Công cụ quản lý MySQL như **MySQL Workbench** hoặc **phpMyAdmin**

### 1.2. Nhập Database
Thực hiện các bước sau để cài đặt database từ file `Manage_Online_Bid_web.sql`:

#### Cách 1: Sử dụng MySQL CLI
1. Mở terminal/cmd và kết nối MySQL:
   ```sh
   mysql -u root -p
   ```
2. Tạo database mới:
   ```
   CREATE DATABASE AuctionDB;
   USE AuctionDB;
   ```
3. Nhập file SQL:
   ```sh
   source /đường/dẫn/đến/file/Manage_Online_Bid_web.sql;
   ```

#### Cách 2: Sử dụng MySQL Workbench
1. Mở MySQL Workbench và kết nối với server.
2. Vào **File** > **Open SQL Script**, chọn file `Manage_Online_Bid_web.sql`.
3. Chạy toàn bộ script để khởi tạo database.

## 2. Cấu Trúc Cơ Sở Dữ Liệu
Database bao gồm các bảng chính sau:
- `users`: Lưu thông tin người dùng.
- `items`: Lưu thông tin sản phẩm đấu giá.
- `bids`: Lưu các lượt đặt giá.
- `transactions`: Quản lý giao dịch.
- `reviews`: Đánh giá người dùng.
- `auto_bidding`: Đấu giá tự động.
- `fraud_detection`: Phát hiện gian lận.

## 3. Tài Khoản Mẫu
Sau khi khởi tạo database, đã có sẵn một số tài khoản mẫu:

| Username  | Password         | Role    | Balance |
|-----------|-----------------|---------|---------|
| buyer1    | hashed_password_1 | buyer   | 500.00  |
| seller1   | hashed_password_2 | seller  | 1000.00 |
| admin1    | hashed_password_3 | admin   | 0.00    |

## 4. Lưu Ý
- Thay đổi thông tin kết nối MySQL trong file cấu hình của dự án để trỏ đến database mới.
- Nếu có lỗi trong quá trình nhập file SQL, kiểm tra lại quyền truy cập MySQL hoặc xem file log để khắc phục.

---
Nếu có vấn đề gì, hãy báo ngay trong nhóm để cùng xử lý! 🚀

