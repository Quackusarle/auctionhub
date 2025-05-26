-- Tạo database
CREATE DATABASE AuctionDB;
USE AuctionDB;

-- Bảng người dùng
CREATE TABLE if not exists users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role ENUM('buyer', 'seller', 'admin') DEFAULT 'buyer',
    verified BOOLEAN DEFAULT FALSE,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng sản phẩm đấu giá
CREATE TABLE if not exists items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    starting_price DECIMAL(10,2) NOT NULL,
    current_price DECIMAL(10,2) DEFAULT 0,
    end_time DATETIME NOT NULL,
    status ENUM('ongoing', 'completed', 'canceled') DEFAULT 'ongoing',
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Bảng đặt giá
CREATE TABLE if not exists bids (
    bid_id INT PRIMARY KEY AUTO_INCREMENT,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    bid_amount DECIMAL(10,2) NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Bảng giao dịch
CREATE TABLE if not exists transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    item_id INT NOT NULL,
    buyer_id INT NOT NULL,
    final_price DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Bảng đánh giá người dùng
CREATE TABLE if not exists reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    reviewer_id INT NOT NULL,
    reviewee_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Bảng đấu giá tự động
CREATE TABLE if not exists auto_bidding (
    auto_bid_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    max_bid DECIMAL(10,2) NOT NULL,
    increment DECIMAL(10,2) DEFAULT 10,
    status ENUM('active', 'disabled') DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

-- Bảng phát hiện gian lận
CREATE TABLE if not exists fraud_detection (
    fraud_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    suspicious_score DECIMAL(5,2) NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

-- Thêm dữ liệu vào bảng users
INSERT INTO users (username, password, email, role, verified, balance) VALUES
('buyer1', 'hashed_password_1', 'buyer1@example.com', 'buyer', TRUE, 500.00),
('seller1', 'hashed_password_2', 'seller1@example.com', 'seller', TRUE, 1000.00),
('admin1', 'hashed_password_3', 'admin1@example.com', 'admin', TRUE, 0.00),
('buyer2', 'hashed_password_4', 'buyer2@example.com', 'buyer', FALSE, 200.00),
('seller2', 'hashed_password_5', 'seller2@example.com', 'seller', TRUE, 750.00);

-- Thêm dữ liệu vào bảng items
INSERT INTO items (seller_id, name, description, image_url, starting_price, current_price, end_time, status) VALUES
(2, 'iPhone 13 Pro', 'Điện thoại Apple iPhone 13 Pro 128GB', 'iphone13.jpg', 800.00, 850.00, '2025-03-10 20:00:00', 'ongoing'),
(2, 'MacBook Air M2', 'Laptop Apple MacBook Air M2 256GB', 'macbook_m2.jpg', 1000.00, 1100.00, '2025-03-12 18:00:00', 'ongoing'),
(5, 'Rolex Submariner', 'Đồng hồ Rolex chính hãng', 'rolex.jpg', 5000.00, 6000.00, '2025-03-15 22:00:00', 'ongoing');

-- Thêm dữ liệu vào bảng bids
INSERT INTO bids (item_id, user_id, bid_amount) VALUES
(1, 1, 820.00),
(1, 4, 830.00),
(2, 1, 1050.00),
(2, 4, 1075.00),
(3, 1, 5500.00);

-- Thêm dữ liệu vào bảng transactions
INSERT INTO transactions (item_id, buyer_id, final_price, status) VALUES
(1, 4, 830.00, 'completed'),
(2, 4, 1075.00, 'pending'),
(3, 1, 5500.00, 'failed');

-- Thêm dữ liệu vào bảng reviews
INSERT INTO reviews (reviewer_id, reviewee_id, rating, comment) VALUES
(1, 2, 5, 'Người bán rất uy tín, sản phẩm chất lượng!'),
(4, 2, 4, 'Giao dịch nhanh chóng, sản phẩm đúng mô tả.'),
(1, 5, 3, 'Hàng ok nhưng giao hàng hơi chậm.');

-- Thêm dữ liệu vào bảng auto_bidding
INSERT INTO auto_bidding (user_id, item_id, max_bid, increment, status) VALUES
(1, 1, 900.00, 20.00, 'active'),
(4, 2, 1200.00, 25.00, 'active');

-- Thêm dữ liệu vào bảng fraud_detection
INSERT INTO fraud_detection (user_id, item_id, suspicious_score) VALUES
(4, 1, 85.50),
(1, 3, 92.00);
