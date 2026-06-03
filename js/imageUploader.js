/**
 * 图片上传模块
 * 使用 WwoPic 图床 API
 */

const ImageUploader = {
    // API 配置
    API_BASE: 'https://img.wwoyun.cn/api/v2',
    TOKEN: '171|ZDEnLUKTwjfvXblPTp7mPsJnB71HZZOcB8fHeiyj401e1955',
    STORAGE_ID: '3',

    /**
     * 上传图片到图床
     * @param {File} file - 图片文件
     * @returns {Promise<{success: boolean, url?: string, error?: string}>}
     */
    async upload(file) {
        if (!file) {
            return { success: false, error: '请选择文件' };
        }

        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (!allowedTypes.includes(file.type)) {
            return { success: false, error: '仅支持 JPG/PNG/GIF/WebP/BMP 格式' };
        }

        // 验证文件大小（最大 10MB）
        if (file.size > 10 * 1024 * 1024) {
            return { success: false, error: '文件大小不能超过 10MB' };
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('storage_id', this.STORAGE_ID);
            formData.append('is_public', 'true');

            const response = await fetch(`${this.API_BASE}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.TOKEN}`,
                    'Accept': 'application/json'
                },
                body: formData
            });

            const result = await response.json();

            if (result.status === 'success' && result.data?.public_url) {
                console.log('[ImageUploader] ✅ 上传成功:', result.data.public_url);
                return { success: true, url: result.data.public_url };
            } else {
                console.error('[ImageUploader] ❌ 上传失败:', result);
                return { success: false, error: result.message || '上传失败' };
            }
        } catch (e) {
            console.error('[ImageUploader] ❌ 上传异常:', e);
            return { success: false, error: '网络错误: ' + e.message };
        }
    },

    /**
     * 显示图片上传对话框
     * @param {Function} callback - 上传成功回调，参数为图片 URL
     */
    showDialog(callback) {
        const modal = document.createElement('div');
        modal.className = 'modal-mask';
        modal.innerHTML = `
            <div class="modal-box" style="max-width: 400px;">
                <h3>📤 上传图片</h3>
                <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 12px;">
                    支持 JPG/PNG/GIF/WebP，最大 10MB
                </p>
                <div id="upload-area" style="border: 2px dashed var(--border); border-radius: var(--radius); padding: 30px; text-align: center; cursor: pointer; transition: all 0.2s;">
                    <div style="font-size: 36px; margin-bottom: 8px;">📁</div>
                    <div style="color: var(--text-secondary);">点击选择图片或拖拽到此处</div>
                    <input type="file" id="upload-file" accept="image/*" style="display: none;">
                </div>
                <div id="upload-preview" style="display: none; margin-top: 12px;">
                    <img id="preview-img" style="max-width: 100%; max-height: 200px; border-radius: var(--radius);">
                </div>
                <div id="upload-status" style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);"></div>
                <div class="modal-actions" style="margin-top: 16px;">
                    <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                    <button class="mp" id="btn-upload" disabled>上传</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const uploadArea = modal.querySelector('#upload-area');
        const fileInput = modal.querySelector('#upload-file');
        const previewDiv = modal.querySelector('#upload-preview');
        const previewImg = modal.querySelector('#preview-img');
        const statusEl = modal.querySelector('#upload-status');
        const btnUpload = modal.querySelector('#btn-upload');
        let selectedFile = null;

        // 点击选择文件
        uploadArea.addEventListener('click', () => fileInput.click());

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary)';
            uploadArea.style.background = 'var(--primary-light)';
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border)';
            uploadArea.style.background = '';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border)';
            uploadArea.style.background = '';
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // 文件选择变化
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        // 处理文件选择
        function handleFile(file) {
            selectedFile = file;
            previewDiv.style.display = 'block';
            previewImg.src = URL.createObjectURL(file);
            statusEl.textContent = `已选择: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`;
            btnUpload.disabled = false;
        }

        // 上传按钮
        btnUpload.addEventListener('click', async () => {
            if (!selectedFile) return;

            btnUpload.disabled = true;
            btnUpload.textContent = '上传中...';
            statusEl.textContent = '正在上传到图床...';

            const result = await ImageUploader.upload(selectedFile);

            if (result.success) {
                statusEl.textContent = '✅ 上传成功！';
                statusEl.style.color = 'var(--success)';
                setTimeout(() => {
                    modal.remove();
                    if (callback) callback(result.url);
                }, 500);
            } else {
                statusEl.textContent = '❌ ' + result.error;
                statusEl.style.color = 'var(--danger)';
                btnUpload.disabled = false;
                btnUpload.textContent = '重试';
            }
        });

        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
};

// 挂载全局
window.ImageUploader = ImageUploader;
export default ImageUploader;
