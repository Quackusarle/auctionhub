GIỚI THIỆU HỆ THỐNG ĐẤU GIÁ TRỰC TUYẾN

Môn học: Lập trình ứng dụng web
Giảng viên: Trần Tuấn Dũng
Nhóm: 13
Thành viên nhóm:
23520564: Nguyễn Đình Hưng
23520648: Trần Quang Huy
23520543: Trần Việt Hoàng
23520247: Hoàng Quốc Đạt

1. Giới thiệu hệ thống

Hệ thống đấu giá trực tuyến được phát triển nhằm tạo ra một nền tảng giao dịch minh bạch và hiệu quả, cho phép người dùng tham gia đấu giá sản phẩm theo thời gian thực. Hệ thống tập trung vào việc xây dựng một kiến trúc backend mạnh mẽ và có khả năng mở rộng cao, hỗ trợ nhiều giao dịch đồng thời mà không làm giảm hiệu suất. Bằng cách này, hệ thống có thể phục vụ nhiều người dùng với các nhu cầu và đặc điểm khác nhau, tạo ra một môi trường đấu giá công bằng và an toàn.

2. Kiến trúc công nghệ

2.1. Nền tảng chính

Django 4.2: Framework chính được sử dụng trong hệ thống, cung cấp cấu trúc MVC hoàn chỉnh, giúp tổ chức mã nguồn rõ ràng và dễ bảo trì. Django được lựa chọn vì tính năng bảo mật mạnh mẽ, cộng đồng lớn và dễ dàng mở rộng.

Django REST Framework: Cung cấp khả năng xây dựng các API RESTful với các tính năng bảo mật cao. Framework này cho phép người dùng dễ dàng tương tác với hệ thống thông qua các dịch vụ web, đồng thời giúp hệ thống dễ dàng mở rộng trong tương lai.

MySQL 8.0: Là hệ quản trị cơ sở dữ liệu quan hệ được sử dụng để lưu trữ tất cả dữ liệu của hệ thống. MySQL 8.0 đáp ứng yêu cầu giao dịch phức tạp với tính ổn định cao và khả năng mở rộng.

2.2. Thành phần bổ trợ

Redis: Được sử dụng để xử lý cache và các tác vụ real-time, Redis giúp giảm thiểu độ trễ trong việc cập nhật giá đấu, thông tin sản phẩm và giao dịch.

Celery: Đây là công cụ dùng để quản lý các tác vụ bất đồng bộ trong hệ thống. Celery sẽ giúp xử lý các công việc nền, như gửi email thông báo, kiểm tra tình trạng đấu giá, và các tác vụ tự động khác mà không làm gián đoạn trải nghiệm người dùng.

JWT (JSON Web Token): Cơ chế xác thực hiện đại giúp hệ thống bảo vệ các API, đảm bảo người dùng chỉ có thể truy cập các tài nguyên của hệ thống khi đã được xác thực đúng đắn.

3. Thiết kế cơ sở dữ liệu

3.1. Mô hình quan hệ

Hệ thống sử dụng mô hình quan hệ với các bảng chính sau:

Người dùng (User): Quản lý thông tin tài khoản người dùng và phân quyền truy cập.

Sản phẩm (Item): Lưu trữ thông tin các sản phẩm được đấu giá, bao gồm mô tả, hình ảnh, giá khởi điểm, và thời gian kết thúc đấu giá.

Đặt giá (Bid): Ghi nhận các lượt đặt giá của người mua đối với sản phẩm. Mỗi bid sẽ chứa thông tin về giá trị và thời gian đặt.

Giao dịch (Transaction): Quản lý kết quả đấu giá thành công, ghi nhận thông tin về người thắng cuộc, giá trị giao dịch và các chi tiết liên quan đến thanh toán.

Đánh giá (Review): Hệ thống feedback để người dùng có thể đánh giá về chất lượng sản phẩm và dịch vụ của người bán.

3.2. Quan hệ chính

Một Người dùng có thể đăng nhiều Sản phẩm.

Mỗi Sản phẩm sẽ nhận được nhiều Đặt giá.

Mỗi Giao dịch sẽ liên kết chặt chẽ với một Sản phẩm và một người thắng cuộc.

4. Cơ chế hoạt động

4.1. Luồng đấu giá cơ bản

Quá trình đấu giá diễn ra theo các bước sau:

Người bán khởi tạo sản phẩm đấu giá trên hệ thống.

Hệ thống tiến hành kiểm tra và phê duyệt sản phẩm để đảm bảo thông tin đầy đủ và hợp lệ.

Người mua tham gia đặt giá trong khoảng thời gian quy định.

Khi thời gian đấu giá kết thúc, hệ thống tự động xác định người thắng cuộc dựa trên giá đặt cao nhất.

4.2. Xử lý real-time

Để đảm bảo các tham gia đấu giá diễn ra mượt mà và nhanh chóng:

WebSocket được sử dụng để cập nhật giá tức thời giữa người dùng và hệ thống. Người dùng có thể theo dõi quá trình đấu giá và nhận thông báo ngay lập tức khi có thay đổi về giá.

Redis đóng vai trò quan trọng trong việc quản lý phiên đấu giá và tối ưu hóa các tác vụ real-time.

Celery được sử dụng để xử lý các tác vụ hẹn giờ tự động, như gửi thông báo khi đấu giá gần kết thúc hoặc khi có thay đổi trong tình trạng sản phẩm.

5. Bảo mật hệ thống

Để bảo vệ hệ thống khỏi các nguy cơ và đảm bảo an toàn cho người dùng, hệ thống áp dụng các biện pháp bảo mật sau:

Xác thực 2 lớp với JWT: Tăng cường bảo mật khi đăng nhập và xác thực các yêu cầu API.

Mã hóa dữ liệu nhạy cảm bằng AES-256: Dữ liệu nhạy cảm như mật khẩu và thông tin tài chính được mã hóa để đảm bảo an toàn tuyệt đối.

Kiểm tra đầu vào chống SQL Injection: Đảm bảo các truy vấn đến cơ sở dữ liệu luôn được kiểm tra và xử lý an toàn.

Giới hạn request phòng chống DDoS: Để tránh tình trạng tấn công từ chối dịch vụ (DDoS), hệ thống áp dụng các biện pháp hạn chế số lượng request từ một địa chỉ IP trong một khoảng thời gian nhất định.

6. Hướng phát triển

Hệ thống có thể được phát triển và mở rộng trong tương lai thông qua các giải pháp sau:

Triển khai hệ thống microservice: Phân chia các thành phần của hệ thống thành các dịch vụ độc lập, giúp tối ưu hóa hiệu suất và khả năng mở rộng.

Tích hợp AI để phát hiện gian lận: Sử dụng trí tuệ nhân tạo để nhận diện các hành vi gian lận trong quá trình đấu giá, đảm bảo tính công bằng cho tất cả người tham gia.

Phát triển cơ chế đấu giá tự động thông minh: Tích hợp các thuật toán tự động giúp đấu giá diễn ra nhanh chóng, đồng thời giảm thiểu sự can thiệp của người dùng và đảm bảo mọi cuộc đấu giá đều được xử lý công bằng.

