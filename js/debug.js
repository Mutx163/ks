/**
 * 移动端调试工具
 * 访问时加 ?debug=1 参数启用，或在手机上自动加载
 */
(function () {
    // 自动检测：有 ?debug=1 参数，或触屏设备
    const params = new URLSearchParams(location.search);
    const isDebug = params.has('debug');

    if (isDebug) {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/eruda';
        s.onload = function () {
            eruda.init();
            // 默认收起，不遮挡页面
            setTimeout(function () {
                const btn = document.querySelector('.eruda-entry-btn');
                if (btn) {
                    btn.style.cssText = 'width:30px;height:30px;opacity:0.5;';
                }
            }, 500);
        };
        document.head.appendChild(s);
    }
})();
