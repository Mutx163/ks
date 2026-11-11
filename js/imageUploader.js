/**
 * 图片上传模块
 * 支持多个图床：WwoPic、Wkds
 */

const ImageUploader = {
    // 图床凭证。构建时通过 VITE_IMG_UPLOAD_TOKEN 注入（Cloudflare Pages 环境变量），
    // 绝不把第三方密钥硬编码进仓库或打进公开 bundle。
    // 未配置时上传会直接提示走 URL 方式，而不是带着空 token 请求。
    TOKEN: (import.meta.env && import.meta.env.VITE_IMG_UPLOAD_TOKEN) || '',
    ENDPOINT:
        (import.meta.env && import.meta.env.VITE_IMG_UPLOAD_ENDPOINT) ||
        'https://img.wwoyun.cn/api/v2/upload',

    isConfigured() {
        return typeof this.TOKEN === 'string' && this.TOKEN.length > 0;
    },

    // 图床配置
    PROVIDERS: {
        wwpic: {
            name: 'WwoPic',
            upload: (file, onProgress) => {
                return new Promise((resolve) => {
                    const xhr = new XMLHttpRequest();
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('storage_id', '3');

                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable && onProgress) {
                            onProgress(Math.round((e.loaded / e.total) * 100));
                        }
                    });

                    xhr.addEventListener('load', () => {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            if (result.status === 'success' && result.data?.public_url) {
                                resolve({ success: true, url: result.data.public_url });
                            } else {
                                resolve({ success: false, error: result.message || '上传失败' });
                            }
                        } catch {
                            resolve({ success: false, error: '解析响应失败' });
                        }
                    });

                    xhr.addEventListener('error', () =>
                        resolve({ success: false, error: '网络错误' })
                    );
                    xhr.open('POST', ImageUploader.ENDPOINT);
                    xhr.setRequestHeader('Authorization', `Bearer ${ImageUploader.TOKEN}`);
                    xhr.send(formData);
                });
            }
        }
    },

    // 当前使用的图床
    getProvider() {
        return 'wwpic';
    },

    /**
     * 压缩图片：长边限制到 maxEdge，输出 JPEG/WebP。
     * 原图直传 10MB 在移动端既慢又浪费图床配额。
     */
    async compress(file, { maxEdge = 1600, quality = 0.85 } = {}) {
        // GIF 压缩会丢掉动画，直接原样返回
        if (!file || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
            if (scale >= 1 && file.size <= 400 * 1024) return file;
            const w = Math.round(bitmap.width * scale);
            const h = Math.round(bitmap.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, w, h);
            bitmap.close?.();
            const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
            if (!blob || blob.size >= file.size) return file;
            return new File(
                [blob],
                file.name.replace(/\.[^.]+$/, type === 'image/png' ? '.png' : '.jpg'),
                {
                    type
                }
            );
        } catch {
            return file;
        }
    },

    /**
     * 上传图片
     * @param {File} file - 图片文件
     * @param {Function} onProgress - 进度回调 (0-100)
     * @returns {Promise<{success: boolean, url?: string, error?: string}>}
     */
    async upload(file, onProgress) {
        if (!file) {
            return { success: false, error: '请选择文件' };
        }

        if (!this.isConfigured()) {
            return {
                success: false,
                error: '图床上传未配置（需要设置 VITE_IMG_UPLOAD_TOKEN），请直接填写图片 URL'
            };
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

        const providerKey = this.getProvider();
        const provider = this.PROVIDERS[providerKey];
        if (!provider) {
            return { success: false, error: '未知图床' };
        }

        try {
            // 上传前压缩，避免 10MB 原图直传
            file = await this.compress(file);
            console.log(`[ImageUploader] 📤 上传到 ${provider.name}...`);
            const result = await provider.upload(file, onProgress);
            if (result.success) {
                console.log('[ImageUploader] ✅ 上传成功:', result.url);
            }
            return result;
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
                <div id="upload-area" style="border: 2px dashed var(--border); border-radius: var(--radius); padding: 30px; text-align: center; cursor: pointer; transition: all 0.2s;">
                    <div style="font-size: 36px; margin-bottom: 8px;">📁</div>
                    <div style="color: var(--text-secondary);">点击选择图片或拖拽到此处</div>
                    <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">支持 JPG/PNG/GIF/WebP，最大 10MB</div>
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
            statusEl.style.color = 'var(--text-tertiary)';

            // 进度条
            statusEl.innerHTML = `
                <div style="margin-top:8px">
                    <div style="background:var(--bg-hover);border-radius:4px;height:6px;overflow:hidden">
                        <div id="upload-progress-bar" style="background:var(--primary);height:100%;width:0%;transition:width 0.2s"></div>
                    </div>
                    <div id="upload-progress-text" style="font-size:11px;margin-top:4px;text-align:center">准备上传...</div>
                </div>
            `;
            const progressBar = modal.querySelector('#upload-progress-bar');
            const progressText = modal.querySelector('#upload-progress-text');

            const result = await ImageUploader.upload(selectedFile, (percent) => {
                progressBar.style.width = percent + '%';
                progressText.textContent = `上传中... ${percent}%`;
            });

            if (result.success) {
                progressBar.style.width = '100%';
                progressBar.style.background = 'var(--success)';
                progressText.textContent = '✅ 上传成功！';
                progressText.style.color = 'var(--success)';
                setTimeout(() => {
                    modal.remove();
                    if (callback) callback(result.url);
                }, 500);
            } else {
                progressBar.style.background = 'var(--danger)';
                progressText.textContent = '❌ ' + result.error;
                progressText.style.color = 'var(--danger)';
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
