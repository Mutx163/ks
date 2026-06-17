-- ============================================
-- 城科卷王 MySQL 建表语句
-- 兼容 MySQL 5.7+
-- ============================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 用户表（同步码为核心标识）
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(8) NOT NULL PRIMARY KEY COMMENT '同步码（6位，如 KW3A7F）',
    `initials` VARCHAR(4) NOT NULL COMMENT '姓名首字母 (1-4字符)',
    `created_at` VARCHAR(30) NOT NULL COMMENT '注册时间 ISO',
    `created_device` VARCHAR(64) DEFAULT '' COMMENT '注册设备标识',
    `settings` TEXT COMMENT '用户设置 JSON',
    `progress` MEDIUMTEXT COMMENT '答题进度 JSON',
    `bookmarks` TEXT COMMENT '收藏数据 JSON',
    `last_sync_at` VARCHAR(30) DEFAULT '' COMMENT '最后同步时间',
    `is_admin` TINYINT DEFAULT 0 COMMENT '是否管理员',
    `banned` TINYINT DEFAULT 0 COMMENT '是否封禁'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 设备表（一个用户可绑定多设备）
CREATE TABLE IF NOT EXISTS `devices` (
    `device_id` VARCHAR(64) NOT NULL PRIMARY KEY COMMENT '设备 UUID',
    `user_id` VARCHAR(8) NOT NULL COMMENT '关联同步码',
    `device_name` VARCHAR(100) DEFAULT '' COMMENT '设备名称（可选）',
    `bound_at` VARCHAR(30) NOT NULL COMMENT '绑定时间',
    INDEX `idx_devices_user` (`user_id`),
    CONSTRAINT `fk_devices_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 答题统计表（每个用户每个题库一条记录）
CREATE TABLE IF NOT EXISTS `stats` (
    `user_id` VARCHAR(8) NOT NULL,
    `bank_id` VARCHAR(50) NOT NULL,
    `bank_name` VARCHAR(100) DEFAULT '',
    `answered` INT DEFAULT 0,
    `correct` INT DEFAULT 0,
    `duration` INT DEFAULT 0 COMMENT '累计学习时长（秒）',
    `updated_at` VARCHAR(30) NOT NULL,
    PRIMARY KEY (`user_id`, `bank_id`),
    INDEX `idx_stats_answered` (`answered` DESC),
    INDEX `idx_stats_duration` (`duration` DESC),
    CONSTRAINT `fk_stats_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告表
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `created_at` VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 题库表（管理后台可编辑）
CREATE TABLE IF NOT EXISTS `banks` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY COMMENT '题库ID（如 c-language）',
    `name` VARCHAR(100) NOT NULL COMMENT '题库名称',
    `description` TEXT COMMENT '题库描述',
    `category` VARCHAR(50) DEFAULT '' COMMENT '分类标签',
    `version` INT DEFAULT 1 COMMENT '版本号',
    `question_count` INT DEFAULT 0 COMMENT '题目数量',
    `questions_json` MEDIUMTEXT NOT NULL COMMENT '题目JSON数组',
    `allowed_modes` VARCHAR(255) DEFAULT '' COMMENT '允许的做题模式JSON数组',
    `enabled` TINYINT DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
    `created_at` VARCHAR(30) NOT NULL,
    `updated_at` VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 题库修改历史
CREATE TABLE IF NOT EXISTS `bank_history` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `bank_id` VARCHAR(50) NOT NULL,
    `action` VARCHAR(30) NOT NULL COMMENT 'create/update/add_question/edit_question/delete_question/upload',
    `detail` TEXT COMMENT '操作描述',
    `operator` VARCHAR(8) DEFAULT '' COMMENT '操作人',
    `snapshot` MEDIUMTEXT COMMENT '快照（可选）',
    `created_at` VARCHAR(30) NOT NULL,
    INDEX `idx_bank_history` (`bank_id`, `created_at` DESC),
    CONSTRAINT `fk_bank_history_bank` FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 应用级配置（如 AI 解读全局配置）
CREATE TABLE IF NOT EXISTS `app_config` (
    `key` VARCHAR(50) NOT NULL PRIMARY KEY,
    `value` MEDIUMTEXT NOT NULL,
    `updated_at` VARCHAR(30) NOT NULL,
    `updated_by` VARCHAR(8) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理员操作日志
CREATE TABLE IF NOT EXISTS `admin_operation_logs` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `action` VARCHAR(30) NOT NULL,
    `target_type` VARCHAR(20) DEFAULT '',
    `target_id` VARCHAR(100) DEFAULT '',
    `detail` TEXT,
    `ok` TINYINT DEFAULT 1,
    `operator` VARCHAR(8) DEFAULT '',
    `created_at` VARCHAR(30) NOT NULL,
    INDEX `idx_admin_logs_created` (`created_at` DESC),
    INDEX `idx_admin_logs_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 前端客户端日志表（控制台错误自动上报）
CREATE TABLE IF NOT EXISTS `client_logs` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `device_id` VARCHAR(64) NOT NULL COMMENT '设备 UUID',
    `level` VARCHAR(10) NOT NULL DEFAULT 'log' COMMENT '日志级别',
    `type` VARCHAR(20) DEFAULT 'console' COMMENT '日志类型',
    `message` VARCHAR(1000) DEFAULT '' COMMENT '日志消息',
    `stack` VARCHAR(2000) DEFAULT '' COMMENT '调用堆栈',
    `page_url` VARCHAR(500) DEFAULT '' COMMENT '页面 URL',
    `source` VARCHAR(500) DEFAULT '' COMMENT '错误来源',
    `line` INT DEFAULT 0 COMMENT '错误行号',
    `col` INT DEFAULT 0 COMMENT '错误列号',
    `ua` VARCHAR(500) DEFAULT '' COMMENT 'User-Agent',
    `created_at` VARCHAR(30) NOT NULL COMMENT '日志时间 ISO',
    INDEX `idx_client_logs_device` (`device_id`, `created_at` DESC),
    INDEX `idx_client_logs_level` (`level`, `created_at` DESC),
    INDEX `idx_client_logs_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
