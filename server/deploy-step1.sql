-- 在 MySQL 中执行，创建数据库和用户
-- 登录 MySQL: mysql -u root -p

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（替换 your_password 为你的密码）
CREATE USER IF NOT EXISTS 'ks_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON ks.* TO 'ks_user'@'localhost';
FLUSH PRIVILEGES;

-- 显示创建结果
SHOW DATABASES LIKE 'ks';
SELECT User, Host FROM mysql.user WHERE User = 'ks_user';
