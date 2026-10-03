// ==UserScript==
// @name              FerryLink
// @namespace         https://github.com/Wjavan/FerryLink
// @version           1.2.1
// @author            Wjavan
// @description       支持百度/阿里/天翼/迅雷/夸克/移动六大网盘直链下载。支持 HTTP/JSON-RPC/cURL，推送至 IDM/XDown/Aria2/NDM/Motrix/终端。基于油小猴(youxiaohou.com)的网盘直链下载助手修改。
// @description:en    Supports Baidu/Ali/Tianyi/Xunlei/Quark/China-Mobile cloud drives. Protocols: HTTP/JSON-RPC/cURL. All configs are embedded locally.A fork of youxiaohou's Pan Download Helper.
// @match             *://pan.baidu.com/disk/home*
// @match             *://yun.baidu.com/disk/home*
// @match             *://pan.baidu.com/disk/main*
// @match             *://yun.baidu.com/disk/main*
// @match             *://openapi.baidu.com/oauth/*
// @match             *://www.aliyundrive.com/drive*
// @match             *://www.alipan.com/drive*
// @match             *://cloud.189.cn/web/*
// @match             *://pan.xunlei.com/*
// @match             *://pan.quark.cn/*
// @match             *://yun.139.com/*
// @match             *://caiyun.139.com/*
// @require           https://unpkg.com/jquery@3.7.0/dist/jquery.min.js
// @require           https://unpkg.com/sweetalert2@10.16.6/dist/sweetalert2.all.min.js
// @require           https://unpkg.com/js-md5@0.7.3/build/md5.min.js
// @connect           baidu.com
// @connect           baidupcs.com
// @connect           jomodns.com
// @connect           aliyundrive.com
// @connect           aliyundrive.net
// @connect           alipan.com
// @connect           aliyundrive.cloud
// @connect           189.cn
// @connect           xunlei.com
// @connect           quark.cn
// @connect           yun.139.com
// @connect           caiyun.139.com
// @connect           localhost
// @connect           127.0.0.1
// @run-at            document-idle
// @grant             GM_xmlhttpRequest
// @grant             GM_setClipboard
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_deleteValue
// @grant             GM_registerMenuCommand
// @grant             GM_cookie
// @grant             GM_openInTab
// @grant             window.close
// @icon              data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjIyIiBmaWxsPSIjMmI3ZmZmIi8+PHBhdGggZD0iTTY0IDMwdjQ2IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMTIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik00NCA1OGwyMCAyMCAyMC0yMCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGZpbGw9Im5vbmUiLz48cmVjdCB4PSIzNCIgeT0iOTAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIxMCIgcng9IjUiIGZpbGw9IiNmZmYiLz48L3N2Zz4=
// @license           GPL-3.0
// @downloadURL https://update.greasyfork.org/scripts/595544/%E7%BD%91%E7%9B%98%E7%9B%B4%E9%93%BE%E4%B8%8B%E8%BD%BD%E5%8A%A9%E6%89%8B.user.js
// @updateURL https://update.greasyfork.org/scripts/595544/%E7%BD%91%E7%9B%98%E7%9B%B4%E9%93%BE%E4%B8%8B%E8%BD%BD%E5%8A%A9%E6%89%8B.meta.js
// ==/UserScript==
(function () {
    'use strict';
    // the three @require libs load from a CDN. If unpkg is unreachable (offline,
    // blocked network) the old code died on `$(document)` with a bare ReferenceError and the
    // user saw nothing at all. Fail with a visible banner instead.
    if (typeof $ === 'undefined' || typeof Swal === 'undefined') {
        const missing = [typeof $ === 'undefined' ? 'jQuery' : null,
                         typeof Swal === 'undefined' ? 'SweetAlert2' : null]
                         .filter(Boolean).join('、');
        document.documentElement.appendChild(Object.assign(document.createElement('div'), {
            textContent: 'FerryLink 依赖加载失败（缺少 ' + missing + '）。请检查网络后刷新，或从 GitHub 手动安装本地依赖版。',
            style: 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#cc3235;color:#fff;padding:8px 12px;font:13px/1.5 sans-serif;text-align:center'
        }));
        return;
    }
    let pt = '', selectList = [], params = {}, mode = '', width = 800, pan = {}, color = '',
        doc = $(document), progress = {}, request = {}, ins = {};

    let watched = {};
    const customClass = {
        popup: 'pl-popup',
        header: 'pl-header',
        title: 'pl-title',
        closeButton: 'pl-close',
        content: 'pl-content',
        input: 'pl-input',
        footer: 'pl-footer'
    };
    const terminalType = {
        wc: "Windows CMD",
        wp: "Windows PowerShell",
        lt: "Linux 终端",
        ls: "Linux Shell",
        mt: "MacOS 终端",
    };
    let toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: false,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
    const message = {
        success: (text) => {
            return toast.fire({title: text, icon: 'success'});
        },
        error: (text) => {
            return toast.fire({title: text, icon: 'error'});
        },
        warning: (text) => {
            return toast.fire({title: text, icon: 'warning'});
        },
        info: (text) => {
            return toast.fire({title: text, icon: 'info'});
        },
        question: (text) => {
            return toast.fire({title: text, icon: 'question'});
        }
    };
    let base = {
        getCookie(name) {
            let cname = name + "=";
            let ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i].trim();
                if (c.indexOf(cname) == 0) return c.substring(cname.length, c.length);
            }
            return "";
        },
        isType(obj) {
            return Object.prototype.toString.call(obj).replace(/^\[object (.+)\]$/, '$1').toLowerCase();
        },
        getValue(name) {
            return GM_getValue(name);
        },
        setValue(name, value) {
            GM_setValue(name, value);
        },
        deleteValue(name) {
            GM_deleteValue(name);
        },
        // alipan keeps rotating its own localStorage token (new access_token +
        getStorage(key) {
            let v = null;
            try {
                v = localStorage.getItem(key);
            } catch (e) { /* storage unavailable */ }
            if (v === null || v === undefined) v = GM_getValue(key, null);
            try {
                return JSON.parse(v);
            } catch (e) {
                return v;
            }
        },
        // ali access tokens are short-lived. When the stored one is at/past its
        async refreshAliToken(tk) {
            if (!tk || !tk.refresh_token) return tk;
            const now = Date.now();
            const exp = tk.expire_time ? Date.parse(tk.expire_time) : 0;
            // refresh a minute early rather than racing the expiry
            if (!exp || exp - now > 60000) return tk;
            try {
                const res = await base.post(
                    'https://api.aliyundrive.com/v2/account/token',
                    { grant_type: 'refresh_token', refresh_token: tk.refresh_token },
                    { 'content-type': 'application/json;charset=utf-8' }
                );
                const merged = Object.assign({}, tk, {
                    access_token: res.access_token,
                    refresh_token: res.refresh_token || tk.refresh_token,
                    token_type: res.token_type || tk.token_type || 'Bearer',
                    expire_time: new Date(now + (res.expire_time ? Date.parse(res.expire_time) : now + 7200000)).toISOString(),
                });
                base.setStorage('token', merged);
                return merged;
            } catch (e) {
                return tk;
            }
        },
        setStorage(key, value) {
            // alipan's own page scripts read the ali token straight out of localStorage,
            // so only that key is mirrored there. Every other credential (access tokens,
            // BDUSS, captcha, device id, etc.) is kept solely in the sandboxed GM storage,
            // which page-level XSS cannot read, instead of being exposed via localStorage.
            let payload = value;
            if (this.isType(value) === 'object' || this.isType(value) === 'array') {
                payload = JSON.stringify(value);
            }
            if (key === 'token') {
                try { localStorage.setItem(key, payload); } catch (e) { /* storage unavailable */ }
            }
            return GM_setValue(key, payload);
        },
        // throws (wrapped), and a failure just means we retry next load rather than blocking
        migrate() {
            const MARK = 'ferrylink_migrated_version';
            const VERSION = '1.2.0';
            try {
                if (GM_getValue(MARK, '') === VERSION) return;
                // orphaned by removing share-page support
                ['shareToken', 'share_token'].forEach((k) => {
                    try { GM_deleteValue(k); localStorage.removeItem(k); } catch (e) {}
                });
                GM_setValue(MARK, VERSION);
            } catch (e) { /* never block startup */ }
        },
        setClipboard(text) {
            GM_setClipboard(text, 'text');
        },
        e(str) {
                        // unescape is deprecated; TextEncoder is the modern equivalent
                        // but btoa still needs a binary string, so use the surrogate-safe form.
                        return btoa(Array.from(new TextEncoder().encode(str), c => String.fromCharCode(c)).join(''));
                    },
        getExtension(name) {
            const reg = /(?!\.)\w+$/;
            if (reg.test(name)) {
                let match = name.match(reg);
                return match[0].toUpperCase();
            }
            return '';
        },
        sizeFormat(value) {
            if (value === +value) {
                let unit = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
                let index = Math.floor(Math.log(value) / Math.log(1024));
                let size = value / Math.pow(1024, index);
                size = size.toFixed(1);
                return size + unit[index];
            }
            return '';
        },
        sortByName(arr) {
            const handle = () => {
                return (a, b) => {
                    const p1 = a.filename ? a.filename : a.server_filename;
                    const p2 = b.filename ? b.filename : b.server_filename;
                    return p1.localeCompare(p2, "zh-CN");
                };
            };
            arr.sort(handle());
        },
        esc(str) {
            return String(str ?? '').replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        },
        fixFilename(name) {
            return String(name || '').replace(/[!?&|`"'*\/:<>\\$;(){}\n\r\x00-\x1F\x7F]/g, '_');
        },
        // sanitize before a filename enters an aria2 RPC out/dir field. aria2
        safeHttpUrl(url) {
            const u = String(url || '');
            if (!/^https?:\/\//i.test(u)) return '';
            return this.esc(u);
        },
        validRpcDomain(domain) {
            const d = String(domain || '').trim();
            if (!d) return false;
            if (d === 'localhost' || d === '::1' || d === '[::1]') return true;
            let host = d;
            try {
                host = new URL(d.includes('://') ? d : 'http://' + d).hostname;
            } catch (e) { return false; }
            if (host === 'localhost' || host === '::1') return true;
            return /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)
                || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
        },
        safeRpcFilename(name) {
            return String(name || '')
                .replace(/[\x00-\x1F\x7F]/g, '')
                .replace(/[/\\]/g, '_')
                .replace(/\.\./g, '_')
                .replace(/^\.+/, '_')
                .slice(0, 255);
        },
        // shared by tianyi + yidong; they were defined only on yidong, so
        // `base.getSign()` in tianyi was undefined and every tianyi download threw.
        getRandomString(len) {
            len = len || 16;
            let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
            let maxPos = $chars.length;
            let pwd = '';
            for (let i = 0; i < len; i++) {
                pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
            }
            return pwd;
        },
        getSign(e, t, a, n) {
            // `i = ""` was an implicit global, which throws ReferenceError under the
            // IIFE's 'use strict' — every yidong download died here. Declare it locally.
            let i = "";
            if (t) {
                let s = Object.assign({}, t);
                i = JSON.stringify(s),
                    i = i.replace(/\s*/g, ""),
                    i = encodeURIComponent(i);
                let c = i.split(""),
                    u = c.sort();
                i = u.join("");
            }
            let A = md5(base.e(i));
            let l = md5(a + ":" + n);
            return md5(A + l).toUpperCase();
        },
        _resetData() {
                    progress = {};
                    $.each(request, (key) => {
                        (request[key]).abort();
                    });
                    $.each(ins, (key) => {
                        clearInterval(ins[key]);
                    });
                    ins = {};
                    request = {};
                },
        post(url, data, headers, type) {
                            if (this.isType(data) === 'object') {
                                data = JSON.stringify(data);
                            }
                            return new Promise((resolve, reject) => {
                                // tracked so _resetData() can abort it; an untracked request
                                // holds its socket and starves every later one.
                                const key = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                                const clear = () => { delete request[key]; };
                                request[key] = GM_xmlhttpRequest({
                                    method: "POST", url, headers, data,
                                    responseType: type || 'json',
                                    timeout: 30000,
                                    ontimeout: () => { clear(); reject(new Error('请求超时（30s）')); },
                                    onload: (res) => {
                                        clear();
                                        if (type === 'blob') { resolve(res); return; }
                                        // a 4xx body is still "loaded", so resolving it
                                        if (res.status >= 400) {
                                            const body = res.response || res.responseText || '';
                                            let msg = 'HTTP ' + res.status;
                                            try {
                                                const parsed = JSON.parse(body);
                                                msg = parsed.message || parsed.msg || parsed.code || msg;
                                            } catch (e) { /* non-JSON error body */ }
                                            reject(new Error(msg));
                                            return;
                                        }
                                        resolve(res.response || res.responseText);
                                    },
                                    onerror: (err) => {
                                        clear();
                                        reject(err);
                                    },
                                });
                            });
                        },
        get(url, headers, type, extra) {
            headers = Object.assign({ 'Referer': location.origin }, headers);
            return new Promise((resolve, reject) => {
                // track from the start, not in onloadstart — if the request
                // errors before onloadstart fires, it's stuck and can't be aborted.
                const key = 'get_' + (extra && extra.index != null ? extra.index : Date.now());
                const clear = () => { delete request[key]; };
                let requestObj = GM_xmlhttpRequest({
                    method: "GET", url, headers,
                    responseType: type || 'json',
                    timeout: type === 'blob' ? 0 : 30000,
                    ontimeout: () => { clear(); reject(new Error('请求超时（30s）')); },
                    onload: (res) => {
                        clear();
                        resolve(res.response || res.responseText);
                    },
                    onprogress: (res) => {
                        if (extra && extra.filename && extra.index != null) {
                            res.total > 0 ? progress[extra.index] = Math.floor(res.loaded * 100 / res.total) : progress[extra.index] = 0;
                        }
                    },
                    onloadstart() {
                        if (extra && extra.filename && extra.index != null) {
                            progress[extra.index] = 0;
                        }
                    },
                    onerror: (err) => {
                        clear();
                        reject(err);
                    },
                });
                request[key] = requestObj;
            });
        },
        getFinalUrl(url, headers) {
            headers = Object.assign({ 'Referer': location.origin }, headers);
            return new Promise((resolve, reject) => {
                // a plain GET streamed the whole body (hundreds of MB) just to read
                const key = 'finalurl_' + Date.now();
                const done = (v) => { delete request[key]; resolve(v); };
                request[key] = GM_xmlhttpRequest({
                    method: "HEAD", url, headers,
                    timeout: 10000,
                    ontimeout: () => { delete request[key]; reject(new Error('请求超时（10s）')); },
                    onload: (res) => { done(res.finalUrl || url); },
                    onerror: () => {
                        delete request[key];
                        request[key] = GM_xmlhttpRequest({
                            method: "GET", url,
                            headers: Object.assign({}, headers, { 'Range': 'bytes=0-0' }),
                            timeout: 10000,
                            ontimeout: () => { delete request[key]; reject(new Error('请求超时（10s）')); },
                            onload: (res) => { done(res.finalUrl || url); },
                            onerror: () => { delete request[key]; resolve(url); }
                        });
                    }
                });
            });
        },
        stringify(obj) {
            let str = '';
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    var value = obj[key];
                    if (Array.isArray(value)) {
                        for (var i = 0; i < value.length; i++) {
                            str += encodeURIComponent(key) + '=' + encodeURIComponent(value[i]) + '&';
                        }
                    } else {
                        str += encodeURIComponent(key) + '=' + encodeURIComponent(value) + '&';
                    }
                }
            }
            return str.slice(0, -1);
        },
        addStyle(id, tag, css) {
            tag = tag || 'style';
            let doc = document, styleDom = doc.getElementById(id);
            if (styleDom) return;
            let style = doc.createElement(tag);
            style.rel = 'stylesheet';
            style.id = id;
            tag === 'style' ? style.innerHTML = css : style.href = css;
            doc.getElementsByTagName('head')[0].appendChild(style);
        },
        sleep(time) {
            return new Promise(resolve => setTimeout(resolve, time));
        },
        findReact(dom, traverseUp = 0) {
            if (!dom) return null;
            const key = Object.keys(dom).find(key => {
                return key.startsWith("__reactFiber$")
                    || key.startsWith("__reactInternalInstance$");
            });
            if (!key) return null;
            const domFiber = dom[key];
            if (domFiber == null) return null;
            if (domFiber._currentElement) {
                let compFiber = domFiber._currentElement._owner;
                for (let i = 0; i < traverseUp; i++) {
                    if (!compFiber || !compFiber._currentElement) return null;
                    compFiber = compFiber._currentElement._owner;
                }
                return compFiber ? compFiber._instance : null;
            }
            const GetCompFiber = fiber => {
                let parentFiber = fiber.return;
                while (parentFiber && typeof parentFiber.type == "string") {
                    parentFiber = parentFiber.return;
                }
                return parentFiber;
            };
            let compFiber = GetCompFiber(domFiber);
            if (!compFiber) return null;
            for (let i = 0; i < traverseUp; i++) {
                compFiber = GetCompFiber(compFiber);
                if (!compFiber) return null;
            }
            return compFiber.stateNode || compFiber;
        },
        initDefaultConfig() {
            let value = [{
                name: 'setting_rpc_domain',
                value: 'http://localhost'
            }, {
                name: 'setting_rpc_port',
                value: '16800'
            }, {
                name: 'setting_rpc_path',
                value: '/jsonrpc'
            }, {
                name: 'setting_rpc_token',
                value: ''
            }, {
                name: 'setting_rpc_dir',
                value: 'C:'
            }, {
                name: 'setting_terminal_type',
                value: /Mac/i.test(navigator.platform) ? 'mt'
                     : /Win/i.test(navigator.platform) ? 'wc' : 'lt'
            }, {
                name: 'setting_theme_color',
                value: '#09AAFF'
            }, {
                // IDM's capture endpoint is a fixed local port (1001) with a client id.
                name: 'setting_idm_rpc',
                value: [{
                    id: '1',
                    default: true
                }]
            }];
            value.forEach((v) => {
                base.getValue(v.name) === undefined && base.setValue(v.name, v.value);
            });
        },
        showSetting() {
                    let dom = '', btn = '',
                colorList = ['#09AAFF', '#cc3235', '#526efa', '#518c17', '#ed944b', '#f969a5', '#bca280'];
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC主机</div><input type="text"  placeholder="主机地址，需带上http(s)://" class="pl-input listener-domain" value="${base.esc(base.getValue('setting_rpc_domain'))}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC端口</div><input type="text" placeholder="端口号，例如：Motrix为16800" class="pl-input listener-port" value="${base.esc(base.getValue('setting_rpc_port'))}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC路径</div><input type="text" placeholder="路径，默认为/jsonrpc" class="pl-input listener-path" value="${base.esc(base.getValue('setting_rpc_path'))}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC密钥</div><input type="text" placeholder="无密钥无需填写" class="pl-input listener-token" value="${base.esc(base.getValue('setting_rpc_token'))}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">保存路径</div><input type="text" placeholder="留空则使用 aria2 默认下载目录；Windows 示例：C:\\Downloads" class="pl-input listener-dir" value="${base.esc(base.getValue('setting_rpc_dir'))}"></label>`;
            colorList.forEach((v) => {
                btn += `<div data-color="${v}" style="background: ${v};border: 1px solid ${v}" class="pl-color-box listener-color ${v === base.getValue('setting_theme_color') ? 'checked' : ''}"></div>`;
            });
            dom += `<label class="pl-setting-label"><div class="pl-label">终端类型</div><select class="pl-input listener-terminal">`;
            Object.keys(terminalType).forEach(k => {
                dom += `<option value="${k}" ${base.getValue('setting_terminal_type') === k ? 'selected' : ''}>${terminalType[k]}</option>`;
            });
            dom += `</select></label>`;
            const idmCfg = base.getValue('setting_idm_rpc');
            const idmId = (Array.isArray(idmCfg) ? (idmCfg.find(i => i && i.default) || idmCfg[0] || {}).id : (idmCfg && idmCfg.id)) || '1';
            dom += `<label class="pl-setting-label"><div class="pl-label">IDM 客户端 ID</div><input type="text" placeholder="IDM 多配置时的客户端编号，默认 1" class="pl-input listener-idm-id" value="${base.esc(idmId)}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">主题颜色</div> <div class="pl-color">${btn}<div></label>`;
            dom = '<div>' + dom + '</div>';
                                                Swal.fire({
                                                    title: '助手配置',
                                                    html: dom,
                                                    icon: 'info',
                                                    showCloseButton: true,
                                                    showConfirmButton: false,
                                                    footer: "",
                                                    target: document.body,
                                                    customClass: {
                                                        container: 'ferrylink-swal-container',
                                                        popup: 'ferrylink-swal-popup'
                                                    },
                                                    didOpen: () => {
                                                            const container = Swal.getContainer();
                                                            const popup = Swal.getPopup();
                                                            if (container) container.style.setProperty('z-index', '2147483647', 'important');
                                                            if (popup) popup.style.setProperty('z-index', '2147483647', 'important');
                                                    },
                                                }).then(() => {
                                                                            message.success('设置成功！');
                                                                            history.go(0);
                                                                        }).catch(err => {
                                                                            console.error('[showSetting] Swal.fire error:', err);
                                                                        });
            doc.on('click', '.listener-color', async (e) => {
                base.setValue('setting_theme_color', e.target.dataset.color);
                message.success('设置成功！');
                // No history.go(0) — theme change applies immediately via CSS update
            });
            doc.on('input', '.listener-domain', async (e) => {
                base.setValue('setting_rpc_domain', e.target.value);
            });
            doc.on('input', '.listener-port', async (e) => {
                base.setValue('setting_rpc_port', e.target.value);
            });
            doc.on('input', '.listener-path', async (e) => {
                base.setValue('setting_rpc_path', e.target.value);
            });
            doc.on('input', '.listener-token', async (e) => {
                base.setValue('setting_rpc_token', e.target.value);
            });
            doc.on('input', '.listener-dir', async (e) => {
                base.setValue('setting_rpc_dir', e.target.value);
            });
            doc.on('input', '.listener-idm-id', async (e) => {
                const v = (e.target.value || '1').trim() || '1';
                base.setValue('setting_idm_rpc', [{ id: v, default: true }]);
            });
            doc.on('change', '.listener-terminal', async (e) => {
                base.setValue('setting_terminal_type', e.target.value);
            });
        },
        registerMenuCommand() {
            GM_registerMenuCommand('设置', () => {
                this.showSetting();
            });
        },
        createTip() {
            $('body').append('<div class="pl-tooltip"></div>');
            doc.on('click', '.listener-link-copy', async (e) => {
                base.setClipboard(e.currentTarget.dataset.link);
                const $btn = $(e.currentTarget);
                const orig = $btn.html();
                $btn.html(orig.replace('复制链接', '已复制'));
                setTimeout(() => { $btn.html(orig); }, 1500);
            });
            doc.on('click', '.listener-link-api-btn', async (e) => {
                base.setClipboard(e.currentTarget.dataset.filename);
                const $btn = $(e.currentTarget);
                const orig = $btn.html();
                $btn.html(orig.replace('复制文件名', '已复制'));
                setTimeout(() => { $btn.html(orig); }, 1500);
            });
            doc.on('mouseenter mouseleave', '.listener-tip', (e) => {
                if (e.type === 'mouseenter') {
                    let filename = e.currentTarget.innerText;
                    let size = e.currentTarget.dataset.size;
                    let tip = `${base.esc(filename)}<span style="margin-left: 10px;color: #f56c6c;">${base.esc(size)}</span>`;
                    $(e.currentTarget).css({opacity: '0.5'});
                    $('.pl-tooltip').html(tip).css({
                        'left': e.pageX + 10 + 'px',
                        'top': e.pageY - e.currentTarget.offsetTop > 14 ? e.pageY + 'px' : e.pageY + 20 + 'px'
                    }).show();
                } else {
                    $(e.currentTarget).css({opacity: '1'});
                    $('.pl-tooltip').hide(0);
                }
            });

            // one registration covers all six adapters — every api row renders this
            doc.on('click', '.listener-idm', async (e) => {
                e.preventDefault();
                const btn = $(e.currentTarget);
                const href = btn.data('link');
                if (!/^https?:\/\//i.test(href || '')) {
                    message.error('提示：下载链接无效！');
                    return;
                }
                // guard against a second click while the first is still in flight —
                if (btn.attr('data-processing') === 'true') return;
                btn.attr('data-processing', 'true');
                const original = btn.html();
                btn.addClass('is-loading').attr('title', '正在推送到 IDM…');
                // from the current page), and those were fine for the other five pans. But
                const res = await base.sendLinkToIDM(href, btn.data('filename'), btn.data('filesize') || 0, /d\.pcs\.baidu\.com/.test(href) ? { 'User-Agent': 'pan.baidu.com' } : {});
                btn.attr('data-processing', 'false');
                btn.removeClass('is-loading');
                if (res === 'success') {
                    btn.addClass('pl-btn-info').text('已推送至 IDM')
                        .animate({opacity: '0.5'}, "slow");
                } else {
                    btn.addClass('pl-btn-danger').text('推送失败：IDM 未响应，请确认已启动并允许连接')
                        .animate({opacity: '0.5'}, "slow");
                    setTimeout(() => {
                        btn.removeClass('pl-btn-danger').html(original)
                            .attr('title', '需 IDM 已启动，且版本支持本地捕获（2019 年后版本）');
                    }, 4000);
                }
            });
        },
        createLoading() {
            return $('<div class="pl-loading"><div class="pl-loading-box"><div><div></div><div></div></div></div></div>');
        },
        createDownloadIframe() {
            if ($('#downloadIframe').length > 0) return;
            let $div = $('<div style="padding:0;margin:0;display:block"></div>');
            let $iframe = $('<iframe src="about:blank" id="downloadIframe" style="display:none"></iframe>');
            $div.append($iframe);
            $('body').append($div);
        },
        // all six adapters download an api link the same way — hand the URL to the browser
        // via a hidden iframe. whether a download manager extension intercepts the
        // resulting navigation is that extension's call; there is no script-side way to
        // prevent it. the IDM button exists for users who want that route.
        iframeDownload(link) {
            if (!/^https?:\/\//i.test(link)) {
                message.error('提示：下载链接无效！');
                return false;
            }
            this.createDownloadIframe();
            $('#downloadIframe').attr('src', link);
            return true;
        },

        // IDM's capture protocol, not an extension sniff. IDM listens on 127.0.0.1:1001
        standHeaders(headers = {}, addDefault = false) {
            if (!headers) return {};
            if (typeof headers === 'string') {
                const raw = {};
                headers.split(/[\r\n]+/).forEach(line => {
                    if (!line.trim() || !line.includes(':')) return;
                    const [key, ...rest] = line.split(':');
                    raw[key.trim().toLowerCase()] = rest.join(':').trim();
                });
                headers = raw;
            }
            let out = {};
            for (let key in headers) {
                const value = typeof headers[key] === 'object' ? JSON.stringify(headers[key]) : String(headers[key]);
                out[key.toLowerCase().split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')] = value;
            }
            if (addDefault) return out;
            return {
                "Dnt": "",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Expires": "0",
                "User-Agent": navigator.userAgent,
                "Origin": location.origin,
                "Referer": `${location.origin}/`,
                ...out
            };
        },
        async sendLinkToIDM(link, filename, filesize, headers = {}) {
            const list = base.getValue('setting_idm_rpc') || [];
            const rpc = list.find(i => i && i.default) || list[0] || { id: '1' };
            // serialised through a promise chain. IDM answers one MSG at a time and
            if (!this.sendLinkToIDM.lock) this.sendLinkToIDM.lock = Promise.resolve();
            return this.sendLinkToIDM.lock = this.sendLinkToIDM.lock.then(async () => {
                headers = this.standHeaders(headers);
                if (!this.sendLinkToIDM.seq) this.sendLinkToIDM.seq = 1;
                const seq = this.sendLinkToIDM.seq;
                const time = Date.now();
                const url = `http://127.0.0.1:1001/client/${encodeURIComponent(rpc.id)}?seq=${seq}`;
                const ext = base.getExtension(filename);
                // quirk 1: IDM's header parser is rigid — without the trailing newline it
                // refuses to parse the block at all.
                const headersText = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
                // quirk 2: the length prefix is a BYTE count, so multi-byte filenames need
                // Blob().size, not String.length (which counts UTF-16 units).
                const format = (key, val) => {
                    if (val === undefined || val === null) return '';
                    const str = String(val);
                    return `${key}=${new Blob([str]).size}:${str}`;
                };
                const fields = [
                    format(4, ext),
                    format(6, link),
                    format(7, location.origin),
                    format(11, headersText),
                    format(100, filename),
                    format(122, 4)
                ];
                // quirk 3: the envelope is undocumented. Read left to right:
                const data = `MSG#${seq}#13#1#10241:${seq + 1000}:0:${time}:0:1:2:${filesize || 0}:0,${fields.join(',')};`;
                // bypass base.post — it rejects on res.status >= 400 and parses as
                const raw = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: "POST", url, data,
                        headers: { "Content-Type": "text/plain" },
                        // withCredentials is required — LinkSwift's
                        withCredentials: true,
                        timeout: 15000,
                        onload: (r) => resolve(r.responseText || r.response || ''),
                        ontimeout: () => resolve(''),
                        onerror: () => resolve(''),
                    });
                });
                const res = raw || false;
                // replay and drops it without answering, so a failed send used to wedge the
                this.sendLinkToIDM.seq++;
                if (res && String(res).endsWith('3;')) {
                    return 'success';
                }
                return 'fail';
            });
        },
        getMirrorList(link, mirror, thread = 2) {
            let host = new URL(link).host;
            let mirrors = [];
            for (let i = 0; i < mirror.length; i++) {
                for (let j = 0; j < thread; j++) {
                    let item = link.replace(host, mirror[i]) + '&'.repeat(j);
                    mirrors.push(item);
                }
            }
            return mirrors.join('\n');
        },
        listenElement(element, callback) {
            if (!element) return;
            if (watched[element]) return;
            watched[element] = true;
            const checkInterval = 500;
            let wasElementFound = false;
            function checkElement() {
                if (document.querySelector(element)) {
                    wasElementFound = true;
                    callback();
                } else if (wasElementFound) {
                    wasElementFound = false;
                }
                setTimeout(checkElement, checkInterval);
            }
            checkElement();
        },
        addPanLinkerStyle() {
            color = base.getValue('setting_theme_color');
            let css = `
            body::-webkit-scrollbar { display: none }
            ::-webkit-scrollbar { width: 6px; height: 10px }
            ::-webkit-scrollbar-track { border-radius: 0; background: none }
            ::-webkit-scrollbar-thumb { background-color: rgba(85,85,85,.4) }
            ::-webkit-scrollbar-thumb,::-webkit-scrollbar-thumb:hover { border-radius: 5px; -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,.2) }
            ::-webkit-scrollbar-thumb:hover { background-color: rgba(85,85,85,.3) }
            .swal2-popup { font-size: 16px !important; }
            .pl-popup { font-size: 12px !important; border-radius: 6px !important; box-shadow: 0 1px 2px rgb(28 28 32 / 4%), 0 6px 16px rgb(28 28 32 / 8%) !important; }
            .pl-popup a { color: ${color} !important; }
            .pl-header { padding: 0 !important; align-items: flex-start !important; border-bottom: 1px solid #e6e8eb !important; margin: 0 0 4px !important; padding: 0 0 8px !important; }
            .pl-title { font-size: 15px !important; font-weight: 600; letter-spacing: -.01em; line-height: 1 !important; white-space: nowrap !important; text-overflow: ellipsis !important; }
            .pl-content { padding: 0 !important; font-size: 12px !important; }
            .pl-main { max-height: 400px; overflow-y: auto; margin: 0 -8px; padding: 0 8px; }
            .pl-footer { font-size: 12px !important; justify-content: flex-start !important; margin: 10px 0 0 !important; padding: 5px 0 0 !important; color: #cc3235 !important; }
            .pl-item { display: flex; align-items: center; line-height: 22px; border-radius: 4px; transition: background 180ms ease; gap: 6px; padding: 6px 8px; }
            .pl-item:hover { background: #f5f6f7; }
            .pl-item-name { flex: 0 0 150px; text-align: left; margin-right: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: default; }
            .pl-item-link { flex: 1; overflow: hidden; text-align: left; white-space: nowrap; text-overflow: ellipsis; cursor: pointer; }
            /* Api rows only. The name is pinned to 118px, a quarter of the 470px the pair gets
               in the 800px popup, so name and link split about 1:3. flex-shrink must stay 0:
               with shrink 1 the link, which grows, crushed the name to about 20px, and that
               read as no change at all. A clipped name stays recoverable, since the
               .listener-tip tooltip on the same element shows it in full on hover. Not applied
               to aria/curl/bc, where the link holds the command itself. Keyed on .pl-row-api,
               which only api rows carry. */
            .pl-row-api .pl-item-name { flex: 0 0 118px; margin-right: 0; min-width: 0; font-weight: 500; color: #111; }
            .pl-row-api .pl-item-link { flex: 1 1 auto; min-width: 60px; overflow: hidden; text-align: left; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #787774; white-space: nowrap; text-overflow: ellipsis; cursor: pointer; }
            .pl-item-btn { flex: 0 0 auto; }
            .pl-a { color: ${color}; text-decoration: none; }
            .pl-a:hover { text-decoration: underline; opacity: 0.8; }
            /* one filled action, two outlined. three identical solid buttons gave the user no
               way to tell which was the real one. every api button carries .pl-btn-primary, so
               the split is by handler: listener-idm is the action, the two copy buttons are
               secondary. */
            button.pl-item-btn { background: ${color} !important; padding: 4px 8px !important; border-radius: 6px !important; line-height: 1 !important; cursor: pointer !important; color: #fff !important; border: 0 !important; height: 32px !important; box-sizing: border-box !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; white-space: nowrap !important; transition: opacity 180ms ease !important; }
            button.pl-item-btn.pl-btn-primary.listener-link-copy,
            button.pl-item-btn.pl-btn-primary.listener-link-api-btn { background: #fff !important; color: #111 !important; border: 1px solid #e6e8eb !important; }
            button.pl-item-btn.pl-btn-primary.listener-link-copy:hover,
            button.pl-item-btn.pl-btn-primary.listener-link-api-btn:hover { background: #f5f6f7 !important; opacity: 1 !important; }
            button.pl-item-btn.pl-btn-primary.listener-link-copy .pl-ico,
            button.pl-item-btn.pl-btn-primary.listener-link-api-btn .pl-ico { stroke: #787774; }
            button.pl-item-btn.pl-btn-primary.listener-link-copy:hover .pl-ico,
            button.pl-item-btn.pl-btn-primary.listener-link-api-btn:hover .pl-ico { stroke: #111; }
            button.pl-item-btn:hover { opacity: 0.9; }
            button.pl-item-btn:active { filter: brightness(.9); }
            button.pl-item-btn:focus-visible { outline: 2px solid ${color}; outline-offset: 2px; }
            button.pl-item-btn:disabled { background: #f5f6f7; color: #c0c4cc; cursor: not-allowed; filter: none; }
            .pl-item-tip { display: flex; justify-content: space-between; flex: 1; }
            .pl-back { width: 70px; background: #f5f6f7; border-radius: 4px; cursor: pointer; margin: 1px 0; transition: background 180ms ease; }
            .pl-back:hover { background: #e6e8eb; }
            .pl-back:focus-visible { outline: 2px solid ${color}; outline-offset: 2px; }
            .pl-ext { display: inline-block; width: 44px; background: #909399; color: #fff; height: 16px; line-height: 16px; font-size: 12px; border-radius: 4px; }
            .pl-btn-primary { background: ${color}; border: 0; border-radius: 6px; color: #fff; cursor: pointer; font-size: 12px; outline: none; display: flex; align-items: center; justify-content: center; margin: 2px 0; padding: 6px 0; min-height: 32px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity 180ms ease; }
            .pl-btn-primary:hover { opacity: 0.9; }
            .pl-btn-primary:active { filter: brightness(.9); }
            .pl-btn-primary:focus-visible { outline: 2px solid ${color}; outline-offset: 2px; }
            .pl-btn-primary:disabled { background: #f5f6f7; color: #c0c4cc; cursor: not-allowed; filter: none; }
            .pl-btn-success { background: #55af28; animation: easeOpacity 1.2s 2; animation-fill-mode:forwards }
            .pl-btn-info { background: #606266; }
            .pl-btn-warning { background: transparent; color: #da9328; border: 1px solid currentColor; }
            .pl-btn-warning:hover { background: color-mix(in srgb, #da9328 12%, transparent); }
            .pl-btn-warning:active { background: color-mix(in srgb, #da9328 20%, transparent); }
            .pl-btn-warning:focus-visible { outline: 2px solid #da9328; outline-offset: 2px; }
            .pl-btn-danger { background: #cc3235; }
            .ali-button { display: inline-flex; align-items: center; justify-content: center; border: 0 solid transparent; border-radius: 5px; white-space: nowrap; flex-shrink: 0; font-size: 14px; line-height: 1.5; outline: 0; touch-action: manipulation; transition: background .3s ease; color: #fff; background: #637dff; margin-left: 20px; padding: 0 12px; position: relative; cursor: pointer; height: 32px; min-height: 32px; }
            .ali-button:hover { background: #7a90ff; }
            .ali-button:focus-visible { outline: 2px solid #637dff; outline-offset: 2px; }
            .xunlei-button { display: inline-flex; align-items: center; justify-content: center; border: 0 solid transparent; border-radius: 5px; white-space: nowrap; flex-shrink: 0; font-size: 14px; line-height: 1.5; outline: 0; touch-action: manipulation; transition: background .3s ease; color: #fff; background: #3f85ff; margin-left: 12px; padding: 0 12px; position: relative; cursor: pointer; height: 36px; min-height: 32px; }
            .xunlei-button:hover { background: #619bff; }
            .xunlei-button:focus-visible { outline: 2px solid #3f85ff; outline-offset: 2px; }
            .tianyi-button { margin-right: 12px; padding: 4px 12px; border-radius: 4px; color: #fff; font-size: 14px; border: 1px solid #0073e3; background: #2b89ea; cursor: pointer; position: relative; min-height: 32px; transition: background .3s ease; width: auto; white-space: nowrap; text-align: center; }
            .tianyi-button:hover { border-color: #1874d3; background: #3699ff; }
            .tianyi-button:focus-visible { outline: 2px solid #2b89ea; outline-offset: 2px; }
            .yidong-button { float: left; position: relative; margin: 20px 24px 20px 0; width: 98px; height: 36px; background: #3181f9; border-radius: 2px; font-size: 14px; color: #fff; line-height: 36px; text-align: center; cursor: pointer; min-height: 32px; transition: background .3s ease; }
            .yidong-button:hover { background: #2d76e5; }
            .yidong-button:focus-visible { outline: 2px solid #3181f9; outline-offset: 2px; }
            .quark-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #ddd; border-radius: 8px; white-space: nowrap; flex-shrink: 0; font-size: 14px; line-height: 1.5; outline: 0; color: #333; background: #fff; margin-right: 10px; padding: 0 14px; position: relative; cursor: pointer; height: 36px; min-height: 32px; transition: background .3s ease; }
            .quark-button:hover { background: #f6f6f6; }
            .quark-button:focus-visible { outline: 2px solid #3f85ff; outline-offset: 2px; }
            .pl-dropdown-menu { position: absolute; right: 0; top: 30px; padding: 5px 0; color: #303133; background: #fff; z-index: 999; width: 102px; border: 1px solid #e6e8eb; border-radius: 6px; box-shadow: 0 1px 2px rgb(28 28 32 / 4%), 0 6px 16px rgb(28 28 32 / 8%); }
            .pl-dropdown-menu-item { min-height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 180ms ease; }
            .pl-dropdown-menu-item:hover { background-color: rgba(132,133,141,0.08); }
            .pl-button .pl-dropdown-menu { display: none; }
            .pl-button:hover .pl-dropdown-menu, .pl-button:focus-within .pl-dropdown-menu { display: block!important; }
            .pl-button-init { opacity: 0.5; animation: easeInitOpacity 1.2s 3; animation-fill-mode:forwards }
             @keyframes easeInitOpacity { from { opacity: 0.5; } 50% { opacity: 1 } to { opacity: 0.5; } }
             @keyframes easeOpacity { from { opacity: 1; } 50% { opacity: 0.35 } to { opacity: 1; } }
            .pl-extra { margin-top: 10px; display: flex }
            .pl-extra button { flex: 1 }
            .tag-danger { color: #cc3235; margin: 0 5px; }
            .pointer { cursor: pointer; }
            .pl-setting-label { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; }
            .pl-label { flex: 0 0 100px; text-align: left; }
            .pl-input { flex: 1; padding: 8px 10px; border: 1px solid #e6e8eb; border-radius: 6px; font-size: 14px; background: #fff; color: #303133; transition: border-color 180ms ease; }
            .pl-input:focus { outline: none; border-color: ${color}; }
            .pl-color { flex: 1; display: flex; flex-wrap: wrap; margin-right: -10px; }
            .pl-color-box { width: 35px; height: 35px; margin: 10px 10px 0 0; box-sizing: border-box; border: 1px solid #e6e8eb; cursor: pointer; }
            .pl-color-box.checked { border: 3px dashed #303133 !important }
            .pl-color-box:focus-visible { outline: 2px solid ${color}; outline-offset: 2px; }
            .pl-close:focus { outline: 0; box-shadow: none; }
            .pl-tooltip { position: absolute; color: #fff; max-width: 600px; font-size: 12px; padding: 5px 10px; background: #333; border-radius: 6px; z-index: 110000; line-height: 1.3; display: none; word-break: break-all; }
             @keyframes load { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
            .pl-loading-box > div > div { position: absolute; border-radius: 50%; }
            .pl-loading-box > div > div:nth-child(1) { top: 9px; left: 9px; width: 82px; height: 82px; background: #fff; }
            .pl-loading-box > div > div:nth-child(2) { top: 14px; left: 38px; width: 25px; height: 25px; background: #909399; animation: load 1s linear infinite; transform-origin: 12px 36px; }
            .pl-loading { width: 16px; height: 16px; display: inline-block; overflow: hidden; background: none; }
            .pl-loading-box { width: 100%; height: 100%; position: relative; transform: translateZ(0) scale(0.16); backface-visibility: hidden; transform-origin: 0 0; }
            .pl-loading-box div { box-sizing: content-box; }
            .swal2-container { z-index: 200000 !important; }
            .ferrylink-swal-container { z-index: 2147483647 !important; }
            .ferrylink-swal-popup { z-index: 2147483647 !important; }
            body.swal2-height-auto { height: inherit !important; }
            .pl-ico { flex: 0 0 auto; width: 14px; height: 14px; margin-right: 5px; vertical-align: -2px; pointer-events: none; }
            .pl-btn-primary.is-loading, .pl-item-btn.is-loading, button.pl-item-btn.is-loading {
                position: relative; color: transparent; pointer-events: none; }
            .pl-btn-primary.is-loading::before, .pl-item-btn.is-loading::before, button.pl-item-btn.is-loading::before {
                content: ""; position: absolute; top: 50%; left: 50%;
                width: 14px; height: 14px; margin: -7px 0 0 -7px;
                border: 2px solid currentColor; border-top-color: transparent;
                border-radius: 50%; color: #fff;
                animation: plSpin 700ms linear infinite; }
            .pl-btn-primary.is-loading > .pl-ico, .pl-item-btn.is-loading > .pl-ico, button.pl-item-btn.is-loading > .pl-ico { display: none; }
            .pl-btn-warning.is-loading::before { color: #da9328; }
             @keyframes plSpin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
            @media (prefers-reduced-motion: reduce) {
                .pl-button-init, .pl-btn-success, .pl-btn-primary.is-loading::before,
                .pl-item-btn.is-loading::before, button.pl-item-btn.is-loading::before { animation: none; }
                .pl-btn-primary, .ali-button, .tianyi-button, .yidong-button,
                .xunlei-button, .quark-button, .pl-dropdown-menu-item, .pl-input { transition: none; }
            }
            .btn-operate .btn-main { display:flex; align-items:center; }
            `;
            this.addStyle('panlinker-style', 'style', css);
        },
    };
    const LOCAL_CONFIG = {
        baidu: {
            pcs: {"0": "https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&dlink=1", "1": "https://pan.baidu.com/api/sharedownload?channel=chunlei&clienttype=12&web=1&app_id=250528", "2": "https://pan.baidu.com/share/tplconfig?fields=sign,timestamp&channel=chunlei&web=1&app_id=250528&clienttype=0", "3": "https://openapi.baidu.com/oauth/2.0/authorize?client_id=IlLqBbU3GjQ0t46TRwFateTprHWl39zF&response_type=token&redirect_uri=oob&confirm_login=0&scope=basic,netdisk", "4": "https://openapi.baidu.com/oauth/2.0/login_success"},
            btn: {"home": ".tcuLAu", "main": ".wp-s-agile-tool-bar__header"},
            ua: "pan.baidu.com",
            api: {0: "API 下载", 1: ''},
            aria: {0: "Aria 下载", 1: ''},
            rpc: {0: "RPC 下载", 1: ''},
            curl: {0: "cURL 下载", 1: ''},
            bc: {0: "BC 下载", 1: ''},
        },
        ali: {
            pcs: {"0": "https://api.aliyundrive.com/v2/file/get_share_link_download_url", "1": "https://api.aliyundrive.com/v2/file/get_download_url"},
            btn: {"home": "[class*=\"header--\"] > [class*=\"actions--\"], [class*=\"header--\"] [class*=\"actions--\"]"},
            dom: {"list": "[class*=\"node-list-table-view--\"]", "grid": "[class*=\"node-list-grid-view--\"]", "switch": "[class*=\"switch-wrapper--\"]"},
            api: {0: "API 下载", 1: ''},
            aria: {0: "Aria 下载", 1: ''},
            rpc: {0: "RPC 下载", 1: ''},
            curl: {0: "cURL 下载", 1: ''},
            bc: {0: "BC 下载", 1: ''},
        },
        tianyi: {
            pcs: {"0": "https://cloud.189.cn/api/open/file/getFileDownloadUrl.action", "1": "https://api.cloud.189.cn/open/oauth2/ssoH5.action", "2": "https://api.cloud.189.cn/open/file/getFileDownloadUrl.action"},
            btn: {"home": "[class*=\"FileHead_file-head-left\"]"},
            api: {0: "API 下载", 1: ''},
            aria: {0: "Aria 下载", 1: ''},
            rpc: {0: "RPC 下载", 1: ''},
            curl: {0: "cURL 下载", 1: ''},
            bc: {0: "BC 下载", 1: ''},
        },
        xunlei: {
            pcs: {"0": "https://api-pan.xunlei.com/drive/v1/files/"},
            btn: {"home": ".FileMenu__menus--HFKwO"},
            mirror: ["vod0007-h05-vip-lixian.xunlei.com", "vod0008-h05-vip-lixian.xunlei.com", "vod0009-h05-vip-lixian.xunlei.com", "vod0010-h05-vip-lixian.xunlei.com", "vod0011-h05-vip-lixian.xunlei.com", "vod0012-h05-vip-lixian.xunlei.com", "vod0013-h05-vip-lixian.xunlei.com", "vod0014-h05-vip-lixian.xunlei.com", "vod0067-aliyun08-vip-lixian.xunlei.com", "vod0254-aliyun08-vip-lixian.xunlei.com", "vod0255-aliyun08-vip-lixian.xunlei.com", "vod0256-aliyun08-vip-lixian.xunlei.com", "vod0257-aliyun08-vip-lixian.xunlei.com", "vod0258-aliyun08-vip-lixian.xunlei.com", "vod0259-aliyun08-vip-lixian.xunlei.com", "vod0260-aliyun08-vip-lixian.xunlei.com", "vod0261-aliyun08-vip-lixian.xunlei.com", "vod0262-aliyun08-vip-lixian.xunlei.com", "vod0263-aliyun08-vip-lixian.xunlei.com", "vod0264-aliyun08-vip-lixian.xunlei.com", "vod0265-aliyun08-vip-lixian.xunlei.com", "vod0266-aliyun08-vip-lixian.xunlei.com", "vod0267-aliyun08-vip-lixian.xunlei.com", "vod0554-aliyun06-vip-lixian.xunlei.com", "vod0555-aliyun06-vip-lixian.xunlei.com", "vod0556-aliyun06-vip-lixian.xunlei.com", "vod0680-aliyun08-vip-lixian.xunlei.com", "vod0681-aliyun08-vip-lixian.xunlei.com", "vod0682-aliyun08-vip-lixian.xunlei.com", "vod0683-aliyun08-vip-lixian.xunlei.com", "vod0684-aliyun08-vip-lixian.xunlei.com", "vod0685-aliyun08-vip-lixian.xunlei.com", "vod0686-aliyun08-vip-lixian.xunlei.com", "vod0687-aliyun08-vip-lixian.xunlei.com", "vod0688-aliyun08-vip-lixian.xunlei.com", "vod0689-aliyun08-vip-lixian.xunlei.com", "vod0690-aliyun08-vip-lixian.xunlei.com", "vod0724-aliyun08-vip-lixian.xunlei.com", "vod0725-aliyun08-vip-lixian.xunlei.com", "vod0726-aliyun08-vip-lixian.xunlei.com", "vod0727-aliyun08-vip-lixian.xunlei.com", "vod0728-aliyun08-vip-lixian.xunlei.com", "vod0075.aliyun06.vip.lixian.xunlei.com", "vod0076.aliyun06.vip.lixian.xunlei.com", "vod0077.aliyun06.vip.lixian.xunlei.com", "vod0779-aliyun04-vip-lixian.xunlei.com", "vod0078.aliyun06.vip.lixian.xunlei.com", "vod0780-aliyun04-vip-lixian.xunlei.com", "vod0781-aliyun04-vip-lixian.xunlei.com", "vod0079.aliyun06.vip.lixian.xunlei.com", "vod0080.aliyun06.vip.lixian.xunlei.com", "vod0117.aliyun04.vip.lixian.xunlei.com", "vod0118.aliyun04.vip.lixian.xunlei.com", "vod0119.aliyun04.vip.lixian.xunlei.com", "vod1284-aliyun06-vip-lixian.xunlei.com", "vod1285-aliyun06-vip-lixian.xunlei.com", "vod1363-aliyun06-vip-lixian.xunlei.com", "vod1371-aliyun06-vip-lixian.xunlei.com", "vod1372-aliyun06-vip-lixian.xunlei.com", "vod1426-aliyun06-vip-lixian.xunlei.com", "vod1427-aliyun06-vip-lixian.xunlei.com", "vod1428-aliyun06-vip-lixian.xunlei.com", "vod1429-aliyun06-vip-lixian.xunlei.com", "vod1442-aliyun06-vip-lixian.xunlei.com", "vod1443-aliyun06-vip-lixian.xunlei.com", "vod1444-aliyun06-vip-lixian.xunlei.com", "vod1445-aliyun06-vip-lixian.xunlei.com", "vod1446-aliyun06-vip-lixian.xunlei.com", "vod1447-aliyun06-vip-lixian.xunlei.com", "vod1469-aliyun06-vip-lixian.xunlei.com", "vod1470-aliyun06-vip-lixian.xunlei.com", "vod1471-aliyun06-vip-lixian.xunlei.com", "vod1489-aliyun06-vip-lixian.xunlei.com", "vod1490-aliyun06-vip-lixian.xunlei.com", "vod1491-aliyun06-vip-lixian.xunlei.com", "vod1492-aliyun06-vip-lixian.xunlei.com", "vod1493-aliyun06-vip-lixian.xunlei.com", "vod0215.aliyun06.vip.lixian.xunlei.com", "vod0216.aliyun06.vip.lixian.xunlei.com", "vod0217.aliyun06.vip.lixian.xunlei.com", "vod0218.aliyun06.vip.lixian.xunlei.com", "vod0219.aliyun06.vip.lixian.xunlei.com", "vod0220.aliyun06.vip.lixian.xunlei.com", "vod0241.aliyun08.vip.lixian.xunlei.com", "vod0244.aliyun08.vip.lixian.xunlei.com", "vod0251.aliyun08.vip.lixian.xunlei.com", "vod0252.aliyun08.vip.lixian.xunlei.com", "vod0253.aliyun08.vip.lixian.xunlei.com", "vod0254.aliyun08.vip.lixian.xunlei.com", "vod0255.aliyun08.vip.lixian.xunlei.com", "vod0256.aliyun08.vip.lixian.xunlei.com", "vod0257.aliyun08.vip.lixian.xunlei.com", "vod0260.aliyun08.vip.lixian.xunlei.com", "vod0261.aliyun08.vip.lixian.xunlei.com", "vod0262.aliyun08.vip.lixian.xunlei.com", "vod0263.aliyun08.vip.lixian.xunlei.com", "vod0264.aliyun08.vip.lixian.xunlei.com", "vod0265.aliyun08.vip.lixian.xunlei.com", "vod0266.aliyun08.vip.lixian.xunlei.com", "vod0267.aliyun08.vip.lixian.xunlei.com", "vod3379-aliyun04-vip-lixian.xunlei.com", "vod3380-aliyun04-vip-lixian.xunlei.com", "vod3429-aliyun04-vip-lixian.xunlei.com", "vod3458-aliyun04-vip-lixian.xunlei.com", "vod3459-aliyun04-vip-lixian.xunlei.com", "vod3496-aliyun04-vip-lixian.xunlei.com", "vod3497-aliyun04-vip-lixian.xunlei.com", "vod3498-aliyun04-vip-lixian.xunlei.com", "vod3499-aliyun04-vip-lixian.xunlei.com", "vod3500-aliyun04-vip-lixian.xunlei.com", "vod3501-aliyun04-vip-lixian.xunlei.com", "vod3522-aliyun04-vip-lixian.xunlei.com", "vod3523-aliyun04-vip-lixian.xunlei.com", "vod3533-aliyun04-vip-lixian.xunlei.com", "vod3534-aliyun04-vip-lixian.xunlei.com", "vod3535-aliyun04-vip-lixian.xunlei.com", "vod3536-aliyun04-vip-lixian.xunlei.com", "vod3549-aliyun04-vip-lixian.xunlei.com", "vod3550-aliyun04-vip-lixian.xunlei.com", "vod3551-aliyun04-vip-lixian.xunlei.com", "vod3552-aliyun04-vip-lixian.xunlei.com", "vod3553-aliyun04-vip-lixian.xunlei.com", "vod3554-aliyun04-vip-lixian.xunlei.com", "vod3555-aliyun04-vip-lixian.xunlei.com", "vod0551.aliyun06.vip.lixian.xunlei.com", "vod0552.aliyun06.vip.lixian.xunlei.com", "vod0553.aliyun06.vip.lixian.xunlei.com", "vod0554.aliyun06.vip.lixian.xunlei.com", "vod0555.aliyun06.vip.lixian.xunlei.com", "vod0556.aliyun06.vip.lixian.xunlei.com", "vod0686.aliyun08.vip.lixian.xunlei.com", "vod0687.aliyun08.vip.lixian.xunlei.com", "vod0688.aliyun08.vip.lixian.xunlei.com", "vod0689.aliyun08.vip.lixian.xunlei.com", "vod0724.aliyun08.vip.lixian.xunlei.com", "vod0725.aliyun08.vip.lixian.xunlei.com", "vod0726.aliyun08.vip.lixian.xunlei.com", "vod0727.aliyun08.vip.lixian.xunlei.com", "vod0728.aliyun08.vip.lixian.xunlei.com", "vod0759.aliyun04.vip.lixian.xunlei.com", "vod0760.aliyun04.vip.lixian.xunlei.com", "vod0769.aliyun04.vip.lixian.xunlei.com", "vod0770.aliyun04.vip.lixian.xunlei.com", "vod0771.aliyun04.vip.lixian.xunlei.com", "vod0772.aliyun04.vip.lixian.xunlei.com", "vod0773.aliyun04.vip.lixian.xunlei.com", "vod0774.aliyun04.vip.lixian.xunlei.com", "vod0775.aliyun04.vip.lixian.xunlei.com", "vod0776.aliyun04.vip.lixian.xunlei.com", "vod0777.aliyun04.vip.lixian.xunlei.com", "vod0778.aliyun04.vip.lixian.xunlei.com", "vod0779.aliyun04.vip.lixian.xunlei.com", "vod0780.aliyun04.vip.lixian.xunlei.com", "vod0781.aliyun04.vip.lixian.xunlei.com", "vod3522.aliyun04.vip.lixian.xunlei.com", "vod3523.aliyun04.vip.lixian.xunlei.com", "vod3533.aliyun04.vip.lixian.xunlei.com", "vod3535.aliyun04.vip.lixian.xunlei.com", "vod3550.aliyun04.vip.lixian.xunlei.com", "vod3551.aliyun04.vip.lixian.xunlei.com", "vod3552.aliyun04.vip.lixian.xunlei.com", "vod3553.aliyun04.vip.lixian.xunlei.com", "vod3554.aliyun04.vip.lixian.xunlei.com", "vod3555.aliyun04.vip.lixian.xunlei.com"],
            api: {0: "API 下载", 1: ''},
            aria: {0: "Aria 下载", 1: ''},
            rpc: {0: "RPC 下载", 1: ''},
            curl: {0: "cURL 下载", 1: ''},
            bc: {0: "BC 下载", 1: ''},
        },
        quark: {
            pcs: {"0": "https://drive.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc"},
            btn: {"home": ".btn-operate .btn-main"},
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch",
            api: {0: "API 下载", 1: ''},
            aria: {0: "Aria 下载", 1: ''},
            rpc: {0: "RPC 下载", 1: ''},
            curl: {0: "cURL 下载", 1: ''},
            bc: {0: "BC 下载", 1: ''},
        },
        yidong: {
            pcs: {"0": "https://personal-kd-njs.yun.139.com/hcy/file/getDownloadUrl", "1": "https://caiyun.139.com/stapi/outlink/content/download"},
            btn: {"home": ".top_button"},
            api: {0: "API 下载", 1: ''},
            aria: {0: "Aria 下载", 1: ''},
            rpc: {0: "RPC 下载", 1: ''},
            curl: {0: "cURL 下载", 1: ''},
            bc: {0: "BC 下载", 1: ''},
        },
    };

    let baidu = {
        _getFidList() {
            let fidlist = [];
            selectList.forEach(v => {
                if (+v.isdir === 1) return;
                let fid = v.fs_id !== undefined && v.fs_id !== null ? v.fs_id
                    : (v.file_id !== undefined && v.file_id !== null ? v.file_id : v.id);
                if (fid !== undefined && fid !== null && fid !== '') fidlist.push(fid);
            });
            return '[' + fidlist + ']';
        },

        setBDUSS(done) {
            const save = (BDUSS) => {
                if (BDUSS) base.setStorage("baiduyunPlugin_BDUSS", {BDUSS});
                done && done(!!BDUSS);
            };
            try {
                if (GM_cookie) {
                    GM_cookie('list', {name: 'BDUSS'}, (cookies, error) => {
                        if (!error && cookies && cookies[0] && cookies[0].value) {
                            save(cookies[0].value);
                        } else {
                            save(base.getCookie('BDUSS'));
                        }
                    });
                    return;
                }
            } catch (e) {
            }
            save(base.getCookie('BDUSS'));
        },
        getBDUSS() {
            let baiduyunPlugin_BDUSS = base.getStorage('baiduyunPlugin_BDUSS') ? base.getStorage('baiduyunPlugin_BDUSS') : '{"baiduyunPlugin_BDUSS":""}';
            return baiduyunPlugin_BDUSS.BDUSS || '';
        },
        convertLinkToAria(link, filename, ua) {
            let BDUSS = this.getBDUSS();
            filename = base.fixFilename(filename);
            let cookie = BDUSS ? ` --header "Cookie: BDUSS=${BDUSS}"` : '';
            return encodeURIComponent(`aria2c "${link}" --out "${filename}" -x 16 -s 16 -k 1M --header "User-Agent: ${ua}"${cookie}`);
        },
        convertLinkToBC(link, filename, ua) {
            let BDUSS = this.getBDUSS();
            let cookie = BDUSS ? `BDUSS=${BDUSS}` : '';
            let bc = `AA/${encodeURIComponent(filename)}/?url=${encodeURIComponent(link)}&cookie=${encodeURIComponent(cookie)}&user_agent=${encodeURIComponent(ua)}ZZ`;
            return encodeURIComponent(`bc://http/${base.e(bc)}`);
        },
        convertLinkToCurl(link, filename, ua) {
            let BDUSS = this.getBDUSS();
            let terminal = base.getValue('setting_terminal_type');
            filename = base.fixFilename(filename);
            let cookie = BDUSS ? ` -b "BDUSS=${BDUSS}"` : '';
            return encodeURIComponent(`${terminal !== 'wp' ? 'curl' : 'curl.exe'} -L -C - "${link}" -o "${filename}" -A "${ua}"${cookie}`);
        },
        addPageListener() {
            function _factory(e) {
                let target = $(e.target);
                let item = target.parents('.pl-item');
                let link = item.find('.pl-item-link');
                let tip = item.find('.pl-item-tip');
                return {
                    item, link, tip, target,
                };
            }
            function _reset(i) {
                ins[i] && clearInterval(ins[i]);
                request[i] && request[i].abort();
                progress[i] = 0;
            }
            doc.on('mouseenter mouseleave click', '.pl-button.g-dropdown-button', (e) => {
                if (e.type === 'mouseleave') {
                    $(e.currentTarget).removeClass('button-open');
                } else {
                    $(e.currentTarget).addClass('button-open');
                    $(e.currentTarget).find('.pl-dropdown-menu').show();
                }
            });
            doc.on('mouseleave', '.pl-button.g-dropdown-button .pl-dropdown-menu', (e) => {
                $(e.currentTarget).hide();
            });
            doc.on('click', '.pl-button-mode', async (e) => {
                            mode = e.target.dataset.mode;
                            Swal.showLoading();
                            try {
                                await this.getPCSLink();
                            } catch (err) {
                                Swal.close();
                                message.error('获取下载链接失败：' + (err && err.message || '未知错误'));
                            } finally {
                                // covers every early-return path in getPCSLink, so a missed
                                if (document.querySelector('.swal2-popup.swal2-loading')) Swal.close();
                            }
                        });
            doc.on('click', '.listener-link-api', (e) => {
                e.preventDefault();
                base.iframeDownload(e.currentTarget.dataset.link);
            });
            doc.on('click', '.listener-back', async (e) => {
                let o = _factory(e);
                o.tip.hide();
                o.link.show();
            });
            doc.on('click', '.listener-link-aria, .listener-copy-all', (e) => {
                e.preventDefault();
                if (!e.target.dataset.link) {
                    $(e.target).removeClass('listener-copy-all').addClass('pl-btn-danger').html(`复制失败，请重新获取下载链接`);
                } else {
                    try { base.setClipboard(decodeURIComponent(e.target.dataset.link)); } catch(e) { base.setClipboard(e.target.dataset.link); }
                    $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(base.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-open-setting', (e) => {
                e.preventDefault();
                e.stopPropagation();
                base.showSetting();
            });
            document.documentElement.addEventListener('mouseup', (e) => {
                if (e.target.nodeName === 'A' && ~e.target.className.indexOf('pl-a')) {
                    e.stopPropagation();
                }
            }, true);
        },
        addButton() {
            if (!pt) return;
            let $toolWrap;
            let $button = $(`<div class="g-dropdown-button pointer pl-button"><div style="color:#fff;background: ${color};border-color:${color}" class="g-button g-button-blue"><span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span></div><div class="menu" style="width:auto;z-index:41;border-color:${color}"><div style="color:${color}" class="g-button-menu pl-button-mode" data-mode="api">API下载</div><div style="color:${color}" class="g-button-menu pl-button-mode" data-mode="aria">Aria下载</div><div style="color:${color}" class="g-button-menu pl-button-mode" data-mode="rpc">RPC下载</div><div style="color:${color}" class="g-button-menu pl-button-mode" data-mode="curl">cURL下载</div><div style="color:${color}" class="g-button-menu pl-button-mode" data-mode="bc">BC下载</div><li class="g-button-menu listener-open-setting">助手设置</li></div></div>`);
            if (pt === 'home') $toolWrap = $(pan.btn.home);
            if (pt === 'main') {
                $toolWrap = $(pan.btn.main);
                $button = $(`<div class="pl-button" style="position: relative; display: inline-block; margin-right: 8px;"><button class="u-button u-button--primary u-button--small is-round is-has-icon" style="background: ${color};border-color: ${color};font-size: 14px; padding: 8px 16px; border: none;"><i class="u-icon u-icon-download"></i><span>下载助手</span></button><ul class="dropdown-list nd-common-float-menu pl-dropdown-menu"><li class="sub cursor-p pl-button-mode" data-mode="api">API下载</li><li class="sub cursor-p pl-button-mode" data-mode="aria">Aria下载</li><li class="sub cursor-p pl-button-mode" data-mode="rpc">RPC下载</li><li class="sub cursor-p pl-button-mode" data-mode="curl">cURL下载</li><li class="sub cursor-p pl-button-mode" data-mode="bc" >BC下载</li><li class="sub cursor-p listener-open-setting">助手设置</li></ul></div>`);
            }
            $toolWrap.prepend($button);
            this.setBDUSS();
            this.addPageListener();
        },
        async getToken() {
            const saveToken = (token) => {
                if (token) {
                    base.setValue('baidu_access_token', token);
                    base.setValue('baidu_access_token_bduss', this.getBDUSS());
                    this.getCurrentUK().then((uk) => {
                        if (uk) base.setValue('baidu_access_token_uk', uk);
                    });
                }
                return token;
            };
            const waitForToken = (maxAttempts = 60) => new Promise((resolve) => {
                let attempts = 0;
                const interval = setInterval(() => {
                    const token = base.getValue('baidu_access_token');
                    if (token) {
                        clearInterval(interval);
                        resolve(token);
                    }
                    attempts++;
                    if (attempts > maxAttempts) {
                        clearInterval(interval);
                        resolve('');
                    }
                }, 1000);
            });
            // HEAD/ranged-GET can extract the token without a tab when the
            // user has already authorised the app — Baidu 302s straight to login_success.
            try {
                if (base.getFinalUrl) {
                    let res = await base.getFinalUrl(pan.pcs[3]);
                    if (res.includes('authorize')) {
                        let html = await base.get(pan.pcs[3], {}, 'text');
                        let bdstoken = html.match(/name="bdstoken"\s+value="([^"]+)"/)?.[1];
                        let client_id = html.match(/name="client_id"\s+value="([^"]+)"/)?.[1];
                        if (bdstoken && client_id) {
                            let data = {
                                grant_permissions_arr: 'netdisk',
                                bdstoken: bdstoken,
                                client_id: client_id,
                                response_type: 'token',
                                display: 'page',
                                grant_permissions: 'basic,netdisk'
                            };
                            await base.post(pan.pcs[3], base.stringify(data), {'Content-Type': 'application/x-www-form-urlencoded'});
                            let res2 = await base.getFinalUrl(pan.pcs[3]);
                            return saveToken(res2.match(/access_token=([^&]+)/)?.[1]);
                        }
                    } else {
                        return saveToken(res.match(/access_token=([^&]+)/)?.[1]);
                    }
                }
            } catch (e) {
            }
            // GM_openInTab: iframe can't click authorise (no @match on oauth page)
            base.deleteValue('baidu_access_token');
            GM_openInTab(pan.pcs[3], {active: false, insert: true, setParent: true});
            let token = await waitForToken(60);
            return saveToken(token);
        },
        async getCurrentUK() {
            try {
                let res = await Promise.race([
                    base.get('https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo', {"User-Agent": pan.ua}),
                    new Promise((resolve) => setTimeout(() => resolve(null), 3000))
                ]);
                if (res && res.errno === 0 && res.user_info && res.user_info.uk) {
                    return String(res.user_info.uk);
                }
            } catch (e) {}
            return '';
        },
        async preflightAccount() {
            try {
                let accessToken = base.getValue('baidu_access_token');
                let storedUK = base.getValue('baidu_access_token_uk');
                if (!accessToken || !storedUK) return;
                let currentUK = await this.getCurrentUK();
                if (!currentUK) return;
                if (currentUK !== storedUK) {
                    base.deleteValue('baidu_access_token');
                    base.deleteValue('baidu_access_token_bduss');
                    base.deleteValue('baidu_access_token_uk');
                    await this.getToken();
                }
            } catch (e) {
                    message.error('百度授权失败：' + (e.message || '未知错误'));
                }
        },
        async getPCSLink(maxRequestTime = 1) {
            selectList = this.getSelectedList();
            let fidList = this._getFidList(), url, res;
            if (pt === 'home' || pt === 'main') {
                if (selectList.length === 0) {
                    Swal.close(); return message.error('提示：请先勾选要下载的文件！');
                }
                if (fidList.length === 2) {
                    Swal.close(); return message.error('提示：请打开文件夹后勾选文件！');
                }
                fidList = encodeURIComponent(fidList);
                let currentBDUSS = this.getBDUSS();
                let storedBDUSS = base.getValue('baidu_access_token_bduss');
                let accessToken = base.getValue('baidu_access_token');
                if (accessToken) {
                    let currentUK = await this.getCurrentUK();
                    let storedUK = base.getValue('baidu_access_token_uk');
                    let mismatch = false;
                    if (currentUK && storedUK && storedUK !== currentUK) mismatch = true;
                    if (!mismatch && currentBDUSS && storedBDUSS && storedBDUSS !== currentBDUSS) mismatch = true;
                    if (mismatch) {
                        base.deleteValue('baidu_access_token');
                        base.deleteValue('baidu_access_token_bduss');
                        base.deleteValue('baidu_access_token_uk');
                        accessToken = '';
                    } else if (currentUK && !storedUK) {
                        base.setValue('baidu_access_token_uk', currentUK);
                    } else if (currentBDUSS && !storedBDUSS) {
                        base.setValue('baidu_access_token_bduss', currentBDUSS);
                    }
                }
                if (!accessToken) accessToken = await this.getToken();
                url = `${pan.pcs[0]}&fsids=${fidList}&access_token=${accessToken}`;
                res = await base.get(url, {"User-Agent": pan.ua});
            }
            if (res.errno === 0) {
                let files = (res.list || []).filter(v => +v.isdir !== 1);
                if (!files.length) {
                    // only retry with a fresh token when the selection actually had files —
                    // an all-folder selection returns an empty list too, and deleting the
                    // token here would force a pointless OAuth popup on the next click.
                    if (fidList !== encodeURIComponent('[]') && maxRequestTime >= 1) {
                        base.deleteValue('baidu_access_token');
                        base.deleteValue('baidu_access_token_bduss');
                        base.deleteValue('baidu_access_token_uk');
                        await this.getToken();
                        return this.getPCSLink(maxRequestTime - 1);
                    }
                    let msg = '所选内容未返回可下载的文件：请确认勾选的是【文件】而不是文件夹，然后刷新页面重试';
                    if (fidList === encodeURIComponent('[]')) {
                        msg = '所选内容中没有可下载的文件（文件夹不支持），请重新勾选文件';
                    }
                    return message.error('提示：' + msg);
                }
                                let html = this.generateDom(files);
            this.showMainDialog(pan[mode][0], html, pan[mode][1]);
                            } else if (res.errno === 112) {
                Swal.close(); return message.error('提示：页面过期，请刷新重试！');
            } else {
                base.deleteValue('baidu_access_token');
                base.deleteValue('baidu_access_token_bduss');
                if (maxRequestTime >= 1) {
                    await this.getToken();
                    await this.getPCSLink(maxRequestTime - 1);
                } else {
                    message.error('提示：获取下载链接失败！请刷新网页后重试！');
                }
            }
        },
        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            base.sortByName(list);
            list.forEach((v, i) => {
                if (v.isdir === 1) return;
                let filename = base.esc(v.server_filename || v.filename);
                let ext = base.getExtension(filename);
                let size = base.sizeFormat(v.size);
                if (!v.dlink) {
                    content += `<div class="pl-item"><div class="pl-item-name listener-tip">${filename}</div><span class="pl-item-link pl-a" style="color:#cc3235">该文件未返回下载链接（可能已失效或被禁止下载）</span></div>`;
                    return;
                }
                let dlink = v.dlink + '&access_token=' + base.getValue('baidu_access_token');
                if (mode === 'api') {
                    content += `<div class="pl-item pl-row-api">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a listener-link-api" href="${base.esc(dlink)}" data-filename="${base.esc(filename)}" data-filesize="${v.size}" data-link="${base.esc(dlink)}" data-index="${i}">${base.esc(dlink)}</a>
                                <button class="pl-item-btn pl-btn-primary listener-idm" data-filename="${base.esc(filename)}" data-filesize="${v.size}" data-link="${base.esc(dlink)}" data-index="${i}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IDM下载</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-copy" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制链接</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-api-btn" data-filename="${base.esc(filename)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制文件名</button>
                                <div class="pl-item-tip" style="display: none"><span>若没有弹出IDM下载框，请在IDM <b>选项</b> -> <b>文件类型</b> -> <b>第一个框</b> 中添加后缀 <span class="pl-ext">${ext}</span> 即可</span> <span class="pl-back listener-back">返回</span></div></div>`;
                }
                if (mode === 'aria') {
                    let alink = this.convertLinkToAria(dlink, filename, pan.ua);
                    if (typeof (alink) === 'object') {
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a" target="_blank" rel="noreferrer noopener" href="${base.safeHttpUrl(alink.link)}" data-filename="${base.esc(filename)}" data-link="${base.safeHttpUrl(alink.link)}">${base.esc(decodeURIComponent(alink.text))}</a> </div>`;
                    } else {
                        alinkAllText += alink + '\r\n';
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a listener-link-aria" href="${base.esc(alink)}" title="点击复制aria2c链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                    }
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到 RPC 下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = this.convertLinkToCurl(dlink, filename, pan.ua);
                    if (typeof (alink) === 'object') {
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a" target="_blank" rel="noreferrer noopener" href="${base.safeHttpUrl(alink.link)}" data-filename="${base.esc(filename)}" data-link="${base.safeHttpUrl(alink.link)}">${base.esc(decodeURIComponent(alink.text))}</a> </div>`;
                    } else {
                        alinkAllText += alink + '\r\n';
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a listener-link-aria" href="${base.esc(alink)}" title="点击复制curl链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                    }
                }
                if (mode === 'bc') {
                    let alink = this.convertLinkToBC(dlink, filename, pan.ua);
                    if (typeof (alink) === 'object') {
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a" target="_blank" rel="noreferrer noopener" href="${base.safeHttpUrl(alink.link)}" data-filename="${base.esc(filename)}" data-link="${base.safeHttpUrl(alink.link)}">${base.esc(decodeURIComponent(alink.text))}</a> </div>`;
                    } else {
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a" href="${base.esc(decodeURIComponent(alink))}" title="点击用比特彗星下载" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                    }
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button></div>`;
            if (mode === 'rpc') {
                let rpc = base.getValue('setting_rpc_domain') + ':' + base.getValue('setting_rpc_port') + base.getValue('setting_rpc_path');
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-send-rpc"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>发送全部链接</button><button title="${rpc}" class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置 RPC 参数（当前为：${rpc}）</button></div>`;
            }
            if (mode === 'curl')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button><button class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px;"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置终端类型（当前为：${terminalType[base.getValue('setting_terminal_type')] || '未知'}）</button></div>`;
            return content;
        },
        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: base.getValue('setting_rpc_domain'),
                port: base.getValue('setting_rpc_port'),
                path: base.getValue('setting_rpc_path'),
                token: base.getValue('setting_rpc_token'),
                dir: base.getValue('setting_rpc_dir'),
            };
            let BDUSS = this.getBDUSS();
            if (!base.validRpcDomain(rpc.domain)) {
                message.error('RPC主机无效，仅允许本机或内网地址（如 http://127.0.0.1）');
                return 'fail';
            }
            let url = `${rpc.domain}:${rpc.port}${rpc.path}`;
            let rpcData = {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [link], {
                    dir: rpc.dir,
                    out: base.safeRpcFilename(filename),
                    header: [`User-Agent: ${pan.ua}`, ...(BDUSS ? [`Cookie: BDUSS=${BDUSS}`] : [])]
                }]
            };
            try {
                let res = await base.post(url, rpcData, {"User-Agent": pan.ua}, '');
                if (res.result) return 'success';
                // aria2 answered but refused — surface its own message so the user
                // can tell a bad token from a bad dir instead of a generic "失败".
                message.error('aria2 拒绝请求：' + ((res.error && res.error.message) || '未知错误（请检查 RPC 密钥与保存路径）'));
                return 'fail';
            } catch (e) {
                // a throw here is almost always "nothing is listening on that port".
                message.error('无法连接 RPC（' + rpc.domain + ':' + rpc.port + '），请确认下载器已启动且 RPC 服务已开启');
                return 'fail';
            }
        },
        getSelectedList() {
            try {
                return require('system-core:context/context.js').instanceForSystem.list.getSelected();
            } catch (e) {
                let pan = document.querySelector('.wp-s-core-pan');
                return pan && pan.__vue__ ? pan.__vue__.selectedList : [];
            }
        },
        detectPage() {
            let path = location.pathname;
            if (/^\/disk\/home/.test(path)) return 'home';
            if (/^\/disk\/main/.test(path)) return 'main';
            return '';
        },
                showMainDialog(title, html, footer) {
                    return Swal.fire({
                        title,
                        html,
                        footer,
                        allowOutsideClick: false,
                        showCloseButton: true,
                        showConfirmButton: false,
                        position: 'top',
                        width,
                        padding: '15px 20px 5px',
                        customClass,
                        willClose: () => {
                            base._resetData();
                        },
                    });
                },
        async initPanLinker() {
            base.initDefaultConfig();
            base.addPanLinkerStyle();
            pt = this.detectPage();
            pan = LOCAL_CONFIG.baidu;
            Object.freeze && Object.freeze(pan);
            this.addButton();
            base.createTip();
            base.registerMenuCommand();
            this.preflightAccount();
        },
        async initAuthorize() {
            let ins = setInterval(() => {
                if (/openapi.baidu.com\/oauth\/2.0\/authorize/.test(location.href)) {
                    let confirmButton =
                        document.querySelector('#auth-allow') ||
                        document.querySelector('#accept') ||
                        document.querySelector('input[type="submit"]') ||
                        Array.from(document.querySelectorAll('button, a, input[type="button"]')).find(el => {
                            let t = (el.textContent || el.value || '').trim();
                            return /^(授权|允许|同意|确认|Allow|Authorize)/i.test(t);
                        });
                    if (confirmButton) {
                        confirmButton.click();
                        return;
                    }
                }
                if (/openapi.baidu.com\/oauth\/2.0\/login_success/.test(location.href)) {
                    if (location.href.includes('access_token')) {
                        let token = location.href.match(/access_token=([^&#]+)/)[1];
                        base.setValue('baidu_access_token', token);
                        this.getCurrentUK().then((uk) => {
                            if (uk) base.setValue('baidu_access_token_uk', uk);
                        });
                        clearInterval(ins);
                        window.close();
                    }
                }
            }, 200)
        }
    };
    let ali = {
        convertLinkToAria(link, filename, ua) {
                    filename = base.fixFilename(filename);
                    // ali's CDN 403s without a browser User-Agent, so aria2 needs the header
                    // too — otherwise the generated command fails where the in-script download now works.
                    return encodeURIComponent(`aria2c "${link}" --out "${filename}" -x 16 -s 16 -k 1M --header "Referer: https://www.aliyundrive.com/" --header "User-Agent: ${ua || navigator.userAgent}"`);
                },
        convertLinkToBC(link, filename, ua) {
            let bc = `AA/${encodeURIComponent(filename)}/?url=${encodeURIComponent(link)}&refer=${encodeURIComponent('https://www.aliyundrive.com/')}ZZ`;
            return encodeURIComponent(`bc://http/${base.e(bc)}`);
        },
        convertLinkToCurl(link, filename, ua) {
            let terminal = base.getValue('setting_terminal_type');
            filename = base.fixFilename(filename);
            // -A is curl's User-Agent flag; ali's CDN 403s without it.
            return encodeURIComponent(`${terminal !== 'wp' ? 'curl' : 'curl.exe'} -L -C - "${link}" -o "${filename}" -e "https://www.aliyundrive.com/" -A "${ua || navigator.userAgent}"`);
        },
        addPageListener() {
            doc.on('click', '.pl-button-mode', async (e) => {
                        mode = e.target.dataset.mode;
                        Swal.showLoading();
                        try {
                            await this.getPCSLink();
                        } catch (err) {
                            Swal.close();
                            message.error('获取下载链接失败：' + (err && err.message || '未知错误'));
                        } finally {
                            // Swal.close() there can no longer strand the spinner and lock the page.
                            // No-op when the download dialog already replaced it.
                            if (document.querySelector('.swal2-popup.swal2-loading')) Swal.close();
                        }
                    });
            doc.on('click', '.listener-link-api', (e) => {
                e.preventDefault();
                base.iframeDownload(e.currentTarget.dataset.link);
            });
            doc.on('click', '.listener-link-aria, .listener-copy-all', (e) => {
                e.preventDefault();
                try { base.setClipboard(decodeURIComponent(e.target.dataset.link)); } catch(e) { base.setClipboard(e.target.dataset.link); }
                $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(base.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-open-setting', (e) => {
                e.preventDefault();
                e.stopPropagation();
                base.showSetting();
            });
        },
        async getRealLink(d, f) {
                    try {
                        let tk = base.getStorage('token');
                        tk = await base.refreshAliToken(tk);
                        if (!tk || !tk.access_token) {
                            Swal.close();
                            return message.error('提示：Token过期或缺失，请刷新网页后重试！');
                        }
                        let authorization = `${tk.token_type} ${tk.access_token}`;
                        let res = await base.post(pan.pcs[1], {
                            drive_id: d,
                            file_id: f
                        }, {
                            authorization,
                            "content-type": "application/json;charset=utf-8",
                            "referer": "https://www.aliyundrive.com/",
                            "x-canary": "client=windows,app=adrive,version=v6.0.0"
                        });
                        if (res.code === 'AccessTokenInvalid') {
                            Swal.close();
                            return message.error('提示：Token过期，请刷新网页后重试！');
                        }
                        if (res.url) {
                            return res.url;
                        }
                        return '';
                    } catch (e) { return ''; }
                },
        addButton() {
            if (!pt) return;
            let $toolWrap;
            let $button = $(`<div class="ali-button pl-button"><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M853.333 938.667H170.667a85.333 85.333 0 0 1-85.334-85.334v-384A85.333 85.333 0 0 1 170.667 384H288a32 32 0 0 1 0 64H170.667a21.333 21.333 0 0 0-21.334 21.333v384a21.333 21.333 0 0 0 21.334 21.334h682.666a21.333 21.333 0 0 0 21.334-21.334v-384A21.333 21.333 0 0 0 853.333 448H736a32 32 0 0 1 0-64h117.333a85.333 85.333 0 0 1 85.334 85.333v384a85.333 85.333 0 0 1-85.334 85.334z" fill="#fff"/><path d="M715.03 543.552a32.81 32.81 0 0 0-46.251 0L554.005 657.813v-540.48a32 32 0 0 0-64 0v539.734L375.893 543.488a32.79 32.79 0 0 0-46.229 0 32.427 32.427 0 0 0 0 46.037l169.557 168.811a32.81 32.81 0 0 0 46.251 0l169.557-168.81a32.47 32.47 0 0 0 0-45.974z" fill="#FF9C00"/></svg><span>下载助手</span><ul class="pl-dropdown-menu"><li class="pl-dropdown-menu-item pl-button-mode" data-mode="api">API下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="aria" >Aria下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="rpc">RPC下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="curl">cURL下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="bc" >BC下载</li><li class="pl-dropdown-menu-item listener-open-setting">助手设置</li></ul></div>`);
            if (pt === 'home') {
                // CSS module class prefixes change between alipan builds.
                // Try the config selector first, then fall back to broader patterns.
                const fallbacks = [
                    pan.btn.home,
                    '[class*="header--"] [class*="actions--"]',
                    '[class*="file-list-header"] [class*="action"]',
                    'header [class*="upload"]',
                ];
                const tryInject = () => {
                    for (const sel of fallbacks) {
                        let $el = $(sel);
                        if ($el.length && $('.pl-button').length === 0) {
                            $el.append($button);
                            return true;
                        }
                    }
                    return false;
                };
                if (!tryInject()) {
                    fallbacks.forEach(sel => base.listenElement(sel, tryInject));
                }
            }
            this.addPageListener();
        },
        async getPCSLink() {
                    selectList = this.getSelectedList();
                    if (selectList.length === 0) {
                        Swal.close(); return message.error('提示：请先勾选要下载的文件！');
                    }
                    if (this.isOnlyFolder()) {
                        Swal.close(); return message.error('提示：请打开文件夹后勾选文件！');
                    }
                let tk = base.getStorage('token');
                tk = await base.refreshAliToken(tk);
                if (!tk || !tk.access_token) {
                    Swal.close(); return message.error('提示：请先登录阿里云盘后再下载！');
                }
                try {
                    let authorization = `${tk.token_type} ${tk.access_token}`;
                    const dlQueue = selectList.map(item => base.post(pan.pcs[1], {
                        drive_id: item.driveId,
                        file_id: item.fileId,
                    }, {
                        authorization,
                        "content-type": "application/json;charset=utf-8",
                        "referer": "https://www.aliyundrive.com/",
                        "x-canary": "client=windows,app=adrive,version=v6.0.0"
                    }));
                    (await Promise.all(dlQueue)).forEach((res, i) => {
                        if (res && res.url) selectList[i].downloadUrl = res.url;
                    });
                } catch (e) {
                    // base.post now rejects on 4xx with the server's own message, so an
                    Swal.close();
                    const m = (e && e.message) || '';
                    if (/AccessTokenInvalid|token/i.test(m)) {
                        return message.error('提示：Token已过期，请刷新网页后重试！');
                    }
                    return message.error('提示：获取下载链接失败（' + m + '），请刷新重试！');
                }
                if (selectList.length > 20) {
                    Swal.close();
                    return message.error('提示：单次最多可勾选 20 个文件！');
                }
                let noUrlSelectList = selectList.filter(v => !Boolean(v.downloadUrl))
                                let queue = [];
                                noUrlSelectList.forEach((item, index) => {
                                    queue.push(this.getRealLink(item.driveId, item.fileId));
                                });
                                const res = await Promise.all(queue);
                                res.forEach((val, index) => {
                                    if (val && typeof val === 'string' && /^https?:/.test(val)) noUrlSelectList[index].downloadUrl = val;
                                });
                                let html = this.generateDom(selectList);
                                                                                            this.showMainDialog(pan[mode][0], html, pan[mode][1]);
                                                        },
                                        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            list.forEach((v, i) => {
                if (v.type === 'folder') return;
                let filename = base.esc(v.name);
                let ext = base.getExtension(v.name);
                let fid = v.fileId;
                let did = v.driveId;
                let size = base.sizeFormat(v.size);
                let dlink = v.downloadUrl;
                                if (mode === 'api') {
                                    content += `<div class="pl-item pl-row-api">
                                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link pl-a listener-link-api" href="${base.esc(dlink)}" data-did="${did}" data-fid="${fid}" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}" data-index="${i}">${base.esc(dlink)}</a>
                                <button class="pl-item-btn pl-btn-primary listener-idm" data-filename="${base.esc(filename)}" data-filesize="${v.size}" data-link="${base.esc(dlink)}" data-index="${i}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IDM下载</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-copy" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制链接</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-api-btn" data-filename="${base.esc(filename)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制文件名</button>
                                                </div>`;
                                }
                if (mode === 'aria') {
                    let alink = this.convertLinkToAria(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制aria2c链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到 RPC 下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = this.convertLinkToCurl(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制curl链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'bc') {
                    let alink = this.convertLinkToBC(dlink, filename, navigator.userAgent);
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link" href="${base.esc(decodeURIComponent(alink))}" title="点击用比特彗星下载" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button></div>`;
            if (mode === 'rpc') {
                let rpc = base.getValue('setting_rpc_domain') + ':' + base.getValue('setting_rpc_port') + base.getValue('setting_rpc_path');
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-send-rpc"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>发送全部链接</button><button title="${rpc}" class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置 RPC 参数（当前为：${rpc}）</button></div>`;
            }
            if (mode === 'curl')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button><button class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px;"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置终端类型（当前为：${terminalType[base.getValue('setting_terminal_type')] || '未知'}）</button></div>`;
            return content;
        },
        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: base.getValue('setting_rpc_domain'),
                port: base.getValue('setting_rpc_port'),
                path: base.getValue('setting_rpc_path'),
                token: base.getValue('setting_rpc_token'),
                dir: base.getValue('setting_rpc_dir'),
            };
            if (!base.validRpcDomain(rpc.domain)) {
                message.error('RPC主机无效，仅允许本机或内网地址（如 http://127.0.0.1）');
                return 'fail';
            }
            let url = `${rpc.domain}:${rpc.port}${rpc.path}`;
                        // ali's CDN 403s any request without a browser User-Agent — it reads as bot
                        const UA = navigator.userAgent;
                        let rpcData = {
                            id: new Date().getTime(),
                            jsonrpc: '2.0',
                            method: 'aria2.addUri',
                            params: [`token:${rpc.token}`, [link], {
                                dir: rpc.dir,
                                out: base.safeRpcFilename(filename),
                                header: [`Referer: https://www.aliyundrive.com/`, `User-Agent: ${UA}`]
                            }]
                        };
                        try {
                            let res = await base.post(url, rpcData, {"Referer": "https://www.aliyundrive.com/"}, '');
                if (res.result) return 'success';
                // can tell a bad token from a bad dir instead of a generic "失败".
                message.error('aria2 拒绝请求：' + ((res.error && res.error.message) || '未知错误（请检查 RPC 密钥与保存路径）'));
                return 'fail';
            } catch (e) {
                message.error('无法连接 RPC（' + rpc.domain + ':' + rpc.port + '），请确认下载器已启动且 RPC 服务已开启');
                return 'fail';
            }
        },
        getSelectedList() {
            try {
                let selectedList = [];
                let tableDom = document.querySelector(pan.dom.list);
                if (tableDom) {
                    // table view: selection lives in props.selectedKeys
                    let reactObj = base.findReact(tableDom, 1);
                    if (reactObj) {
                        let props = reactObj.pendingProps;
                        if (props) {
                            let fileList = props.dataSource || [];
                            let selectedKeys = (props.selectedKeys != null) ? (Array.isArray(props.selectedKeys) ? props.selectedKeys : String(props.selectedKeys).split(',')) : [];
                            fileList.forEach((val) => {
                                if (selectedKeys.includes(val.fileId)) {
                                    selectedList.push(Object.assign({}, val));
                                }
                            });
                        }
                    }
                    return selectedList;
                }

                // grid view (the only view alipan ships now) has no selectedKeys
                let gridDom = document.querySelector(pan.dom.grid);
                if (!gridDom) return [];
                // traverseUp must stay 0 here. CDP-verified on alipan 6.8.12 —
                let gridReact = base.findReact(gridDom, 0);
                if (!gridReact) return [];
                let dataSource = (gridReact.pendingProps || {}).dataSource || [];
                if (!dataSource.length) return [];
                document.querySelectorAll('[class*="node-card-container"]').forEach((card) => {
                    let cb = card.querySelector('input[type=checkbox]');
                    if (!cb || !cb.checked) return;
                    let title = card.getAttribute('title') || '';
                    let hit = dataSource.find((v) => v.name === title);
                    if (hit) selectedList.push(Object.assign({}, hit));
                });
                return selectedList;
            } catch (e) {
                return [];
            }
        },

        detectPage() {
            let path = location.pathname;
            if (/^\/(drive)/.test(path)) return 'home';
            return '';
        },
        isOnlyFolder() {
            for (let i = 0; i < selectList.length; i++) {
                if (selectList[i].type === 'file') return false;
            }
            return true;
        },
                showMainDialog(title, html, footer) {
                    return Swal.fire({
                        title,
                        html,
                        footer,
                        allowOutsideClick: false,
                        showCloseButton: true,
                        showConfirmButton: false,
                        position: 'top',
                        width,
                        padding: '15px 20px 5px',
                        customClass,
                        willClose: () => {
                            base._resetData();
                        },
                    });
                },
        async initPanLinker() {
            base.initDefaultConfig();
            base.addPanLinkerStyle();
            pt = this.detectPage();
            pan = LOCAL_CONFIG.ali;
            Object.freeze && Object.freeze(pan);
            this.addButton();
            base.createTip();
            base.registerMenuCommand();
        }
    };
    let tianyi = {
        convertLinkToAria(link, filename, ua) {
            filename = base.fixFilename(filename);
            return encodeURIComponent(`aria2c "${link}" --out "${filename}" -x 16 -s 16 -k 1M`);
        },
        convertLinkToBC(link, filename, ua) {
            let bc = `AA/${encodeURIComponent(filename)}/?url=${encodeURIComponent(link)}ZZ`;
            return encodeURIComponent(`bc://http/${base.e(bc)}`);
        },
        convertLinkToCurl(link, filename, ua) {
            let terminal = base.getValue('setting_terminal_type');
            filename = base.fixFilename(filename);
            return encodeURIComponent(`${terminal !== 'wp' ? 'curl' : 'curl.exe'} -L -C - "${link}" -o "${filename}"`);
        },
        addPageListener() {
                    doc.on('click', '.pl-button-mode', async (e) => {
                        mode = e.target.dataset.mode;
                        Swal.showLoading();
                        try {
                            await this.getPCSLink();
                        } catch (err) {
                            Swal.close();
                            message.error('获取下载链接失败：' + (err && err.message || '未知错误'));
                        } finally {
                            // Swal.close() there can no longer strand the spinner and lock the page.
                            // No-op when the download dialog already replaced it.
                            if (document.querySelector('.swal2-popup.swal2-loading')) Swal.close();
                        }
                    });
            doc.on('click', '.listener-link-api', async (e) => {
                e.preventDefault();
base.iframeDownload(e.currentTarget.dataset.link);
            });
            doc.on('click', '.listener-link-aria, .listener-copy-all', (e) => {
                e.preventDefault();
                try { base.setClipboard(decodeURIComponent(e.target.dataset.link)); } catch(e) { base.setClipboard(e.target.dataset.link); }
                $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(base.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-open-setting', (e) => {
                e.preventDefault();
                e.stopPropagation();
                base.showSetting();
            });
        },
        _insertBeforeUpload(container, $button) {
            // Use prepend to place button before all existing children (including 上传)
            if (container.firstChild) {
                container.insertBefore($button[0], container.firstChild);
            } else {
                container.appendChild($button[0]);
            }
        },
        addButton() {
            if (!pt) return;
            let $toolWrap;
            let $button = $(`<div class="tianyi-button pl-button">下载助手<ul class="pl-dropdown-menu" style="top: 26px;"><li class="pl-dropdown-menu-item pl-button-mode" data-mode="api">API下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="aria" >Aria下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="rpc">RPC下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="curl">cURL下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="bc" >BC下载</li><li class="pl-dropdown-menu-item listener-open-setting">助手设置</li></ul></div>`);
            if (pt === 'home') {
                            base.listenElement(pan.btn.home, () => {
                                let container = document.querySelector(pan.btn.home);
                                if (container && $('.pl-button').length === 0) {
                                    this._insertBeforeUpload(container, $button);
                                    // Sync button width to dropdown menu width
                                    setTimeout(() => {
                                        const menu = $button.find('.pl-dropdown-menu');
                                        if (menu.length) {
                                            $button.css('width', menu.outerWidth() + 'px');
                                        }
                                    }, 100);
                                }
                            })
                        }
            this.addPageListener();
        },
        async getToken() {
            let res = await base.getFinalUrl(pan.pcs[1], {});
            let accessToken = res.match(/accessToken=(\w+)/)?.[1];
            accessToken && base.setStorage('accessToken', accessToken);
            return accessToken;
        },
        async getFileUrlByOnce(item, index, token) {
            try {
                if (item.downloadUrl) return {
                    index,
                    downloadUrl: item.downloadUrl
                };
                let time = Date.now(),
                    fileId = item.fileId,
                    o = "AccessToken=" + token + "&Timestamp=" + time + "&fileId=" + fileId,
                    url = pan.pcs[2] + '?fileId=' + fileId;
                let sign = md5(o).toString();
                let res = await base.get(url, {
                    "accept": "application/json;charset=UTF-8",
                    "sign-type": 1,
                    "accesstoken": token,
                    "timestamp": time,
                    "signature": sign
                });
                if (res.res_code === 0) {
                    return {
                        index,
                        downloadUrl: res.fileDownloadUrl
                    };
                } else if (res.errorCode === 'InvalidSessionKey') {
                    return {
                        index,
                        downloadUrl: '提示：请先登录网盘！'
                    };
                    return {
                        index,
                        downloadUrl: '提示：请先[转存]文件，前往[我的网盘]中下载！'
                    };
                } else {
                    return {
                        index,
                        downloadUrl: '获取下载地址失败，请刷新重试！'
                    };
                }
            } catch (e) {
                return {
                    index,
                    downloadUrl: '获取下载地址失败，请刷新重试！'
                };
            }
        },
        async getPCSLink() {
                    selectList = this.getSelectedList();
                    if (selectList.length === 0) {
                        Swal.close(); return message.error('提示：请先勾选要下载的文件！');
                    }
                    if (this.isOnlyFolder()) {
                        Swal.close(); return message.error('提示：请打开文件夹后勾选文件！');
                    }
            let token = base.getStorage('accessToken') || await this.getToken();
            if (!token) {
                Swal.close(); return message.error('提示：请先登录网盘！');
            }
            let queue = [];
            selectList.forEach((item, index) => {
                queue.push(this.getFileUrlByOnce(item, index, token));
            });
            const res = await Promise.all(queue);
            res.forEach(val => {
                selectList[val.index].downloadUrl = val.downloadUrl;
            });
            let html = this.generateDom(selectList);
            this.showMainDialog(pan[mode][0], html, pan[mode][1]);
        },
        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            list.forEach((v, i) => {
                if (v.isFolder) return;
                let filename = base.esc(v.fileName);
                let size = base.sizeFormat(v.size);
                let dlink = v.downloadUrl;
                if (!/^https?:\/\//.test(dlink)) {
                    content += `<div class="pl-item"><div class="pl-item-name">${filename}</div><span class="pl-item-link pl-a" style="color:#cc3235">${base.esc(dlink)}</span></div>`;
                    return;
                }
                if (mode === 'api') {
                    content += `<div class="pl-item pl-row-api">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-api" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}" data-index="${i}">${base.esc(dlink)}</a>
                                <button class="pl-item-btn pl-btn-primary listener-idm" data-filename="${base.esc(filename)}" data-filesize="${v.size}" data-link="${base.esc(dlink)}" data-index="${i}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IDM下载</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-copy" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制链接</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-api-btn" data-filename="${base.esc(filename)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制文件名</button>
                                </div>`;
                }
                if (mode === 'aria') {
                    let alink = this.convertLinkToAria(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制aria2c链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到 RPC 下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = this.convertLinkToCurl(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制curl链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'bc') {
                    let alink = this.convertLinkToBC(dlink, filename, navigator.userAgent);
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link" href="${base.esc(decodeURIComponent(alink))}" title="点击用比特彗星下载" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button></div>`;
            if (mode === 'rpc') {
                let rpc = base.getValue('setting_rpc_domain') + ':' + base.getValue('setting_rpc_port') + base.getValue('setting_rpc_path');
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-send-rpc"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>发送全部链接</button><button title="${rpc}" class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置 RPC 参数（当前为：${rpc}）</button></div>`;
            }
            if (mode === 'curl')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button><button class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px;"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置终端类型（当前为：${terminalType[base.getValue('setting_terminal_type')] || '未知'}）</button></div>`;
            return content;
        },
        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: base.getValue('setting_rpc_domain'),
                port: base.getValue('setting_rpc_port'),
                path: base.getValue('setting_rpc_path'),
                token: base.getValue('setting_rpc_token'),
                dir: base.getValue('setting_rpc_dir'),
            };
            if (!base.validRpcDomain(rpc.domain)) {
                message.error('RPC主机无效，仅允许本机或内网地址（如 http://127.0.0.1）');
                return 'fail';
            }
            let url = `${rpc.domain}:${rpc.port}${rpc.path}`;
            let rpcData = {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [link], {
                    dir: rpc.dir,
                    out: base.safeRpcFilename(filename),
                    header: []
                }]
            };
            try {
                let res = await base.post(url, rpcData, {}, '');
                if (res.result) return 'success';
                // can tell a bad token from a bad dir instead of a generic "失败".
                message.error('aria2 拒绝请求：' + ((res.error && res.error.message) || '未知错误（请检查 RPC 密钥与保存路径）'));
                return 'fail';
            } catch (e) {
                message.error('无法连接 RPC（' + rpc.domain + ':' + rpc.port + '），请确认下载器已启动且 RPC 服务已开启');
                return 'fail';
            }
        },
        getSelectedList() {
            try {
                return document.querySelector(".c-file-list").__vue__.selectedList;
            } catch (e) {
                let detail = document.querySelector(".info-detail");
                return detail && detail.__vue__ ? [detail.__vue__.fileDetail] : [];
            }
        },
        detectPage() {
            let path = location.pathname;
            if (/^\/web\/main/.test(path)) return 'home';
            return '';
        },
        isOnlyFolder() {
            for (let i = 0; i < selectList.length; i++) {
                if (!selectList[i].isFolder) return false;
            }
            return true;
        },
                showMainDialog(title, html, footer) {
                    return Swal.fire({
                        title,
                        html,
                        footer,
                        allowOutsideClick: false,
                        showCloseButton: true,
                        showConfirmButton: false,
                        position: 'top',
                        width,
                        padding: '15px 20px 5px',
                        customClass,
                        willClose: () => {
                            base._resetData();
                        },
                    });
                },
        async initPanLinker() {
            base.initDefaultConfig();
            base.addPanLinkerStyle();
            pt = this.detectPage();
            pan = LOCAL_CONFIG.tianyi;
            Object.freeze && Object.freeze(pan);
            this.addButton();
            this.getToken();
            base.createTip();
            base.registerMenuCommand();
        }
    };
    let xunlei = {
        _homeSelectors: [
            '.FileMenu__container--yB0l1',
            '.FileMenu__menus--HFKwO',
            '.file-menu',
            '.source-list-menu',
        ],
        convertLinkToAria(link, filename, ua) {
            filename = base.fixFilename(filename);
            return encodeURIComponent(`aria2c "${link}" --out "${filename}" -x 16 -s 16 -k 1M`);
        },
        convertLinkToBC(link, filename, ua) {
            let bc = `AA/${encodeURIComponent(filename)}/?url=${encodeURIComponent(link)}ZZ`;
            return encodeURIComponent(`bc://http/${base.e(bc)}`);
        },
        convertLinkToCurl(link, filename, ua) {
            let terminal = base.getValue('setting_terminal_type');
            filename = base.fixFilename(filename);
            return encodeURIComponent(`${terminal !== 'wp' ? 'curl' : 'curl.exe'} -L -C - "${link}" -o "${filename}"`);
        },
        addPageListener() {
                    doc.on('click', '.pl-button-mode', async (e) => {
                        mode = e.target.dataset.mode;
                        Swal.showLoading();
                        try {
                            await this.getPCSLink();
                        } catch (err) {
                            Swal.close();
                            message.error('获取下载链接失败：' + (err && err.message || '未知错误'));
                        } finally {
                            // Swal.close() there can no longer strand the spinner and lock the page.
                            // No-op when the download dialog already replaced it.
                            if (document.querySelector('.swal2-popup.swal2-loading')) Swal.close();
                        }
                    });
            doc.on('click', '.listener-link-api', async (e) => {
                e.preventDefault();
base.iframeDownload(e.currentTarget.dataset.link);
            });
            doc.on('click', '.listener-link-media', async (e) => {
                e.preventDefault();
base.iframeDownload(e.currentTarget.dataset.link);
                $(e.currentTarget).text('已触发下载，若未弹出请检查浏览器下载设置').animate({opacity: '0.5'}, "slow");
            });


            doc.on('click', '.listener-link-bc-btn', async (e) => {
                let mirror = base.getMirrorList(e.target.dataset.dlink, pan.mirror);
                base.setClipboard(mirror);
                $(e.target).text('复制成功').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-link-aria, .listener-copy-all', (e) => {
                e.preventDefault();
                try { base.setClipboard(decodeURIComponent(e.target.dataset.link)); } catch(e) { base.setClipboard(e.target.dataset.link); }
                $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(base.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-open-setting', (e) => {
                e.preventDefault();
                e.stopPropagation();
                base.showSetting();
            });
        },
        _findHomeContainer() {
            if (pan.btn && pan.btn.home) {
                let el = document.querySelector(pan.btn.home);
                if (el) return el;
            }
            for (let sel of this._homeSelectors) {
                let el = document.querySelector(sel);
                if (el) return el;
            }
            return null;
        },
        addButton() {
            if (!pt) return;
            let $toolWrap;
            let $button = $(`<div class="xunlei-button pl-button"><i class="xlpfont xlp-download"></i><span style="font-size: 13px;margin-left: 6px;">下载助手</span><ul class="pl-dropdown-menu" style="top: 34px;"><li class="pl-dropdown-menu-item pl-button-mode" data-mode="api">API下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="aria" >Aria下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="rpc">RPC下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="curl">cURL下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="bc" >BC下载</li><li class="pl-dropdown-menu-item listener-open-setting">助手设置</li></ul></div>`);
            if (pt === 'home') {
                this._smartListen(() => {
                    let container = this._findHomeContainer();
                    if (container && $('.pl-button').length === 0) {
                        $(container).prepend($button);
                    }
                });
            }
            this.addPageListener();
        },
        _smartListen(callback) {
            const checkInterval = 500;
            function check() {
                callback();
                setTimeout(check, checkInterval);
            }
            check();
        },
        getToken() {
            let credentials = {}, captcha = {};
            for (let i = 0; i < localStorage.length; i++) {
                let key = localStorage.key(i);
                if (/^credentials_/.test(key)) {
                    credentials = base.getStorage(key);
                }
                if (/^captcha_[\w]{16}/.test(key)) {
                    captcha = base.getStorage(key);
                }
            }
            let deviceid = '';
            try {
                let lsDevice = base.getStorage('deviceid');
                if (lsDevice) {
                    if (typeof lsDevice === 'string' && lsDevice.includes(',')) {
                        let match = /(\w{32})/.exec(lsDevice.split(','));
                        if (match) deviceid = match[1];
                    } else if (typeof lsDevice === 'string') {
                        let match = /(\w{32})/.exec(lsDevice);
                        if (match) deviceid = match[1];
                    }
                }
            } catch (e) {}
            if (!deviceid) {
                let cookieDevice = base.getCookie('peerid') || base.getCookie('deviceid');
                if (cookieDevice) {
                    if (cookieDevice.includes('.') && cookieDevice.length > 32) {
                        let parts = cookieDevice.split('.');
                        if (parts[1] && parts[1].length >= 32) {
                            deviceid = parts[1].substring(0, 32);
                        }
                    }
                    if (!deviceid) {
                        let match = /([0-9a-f]{32})/i.exec(cookieDevice);
                        if (match) deviceid = match[1];
                    }
                }
            }
            if (!deviceid) {
                deviceid = Array.from({length: 32}, () =>
                    Math.floor(Math.random() * 16).toString(16)
                ).join('');
            }
            let token = {
                credentials,
                captcha,
                deviceid
            };
            return token;
        },
        async getFileUrlByOnce(item, index, token) {
            try {
                if (item.downloadUrl) return {
                    index,
                    downloadUrl: item.downloadUrl
                };
                let headers = {
                    'content-type': "application/json",
                    'x-device-id': token.deviceid,
                };
                if (token.credentials && token.credentials.access_token) {
                    let tokenType = token.credentials.token_type || 'Bearer';
                    headers['Authorization'] = `${tokenType} ${token.credentials.access_token}`;
                }
                if (token.captcha && token.captcha.token) {
                    headers['x-captcha-token'] = token.captcha.token;
                }
                let res = await base.get(pan.pcs[0] + item.id, headers);
                if (res.web_content_link) {
                    let mediaLink = '';
                    if (Array.isArray(res.medias) && res.medias.length > 0) {
                        let media = res.medias.find(m => m && m.link && m.link.url && m.media_name !== '原始画质') || res.medias[0];
                        if (media && media.link && media.link.url) {
                            mediaLink = media.link.url;
                        }
                    }
                    return {
                        index,
                        downloadUrl: res.web_content_link,
                        mediaLink
                    };
                } else if (res.reason) {
                    return {
                        index,
                        downloadUrl: '获取失败：' + (res.reason || res.message || '未知错误')
                    };
                } else {
                    return {
                        index,
                        downloadUrl: '获取下载地址失败，请刷新重试！'
                    };
                }
            } catch (e) {
                return {
                    index,
                    downloadUrl: '获取下载地址失败，请刷新重试！'
                };
            }
        },
        async getPCSLink() {
                    selectList = this.getSelectedList();
                    if (selectList.length === 0) {
                        Swal.close(); return message.error('提示：请先勾选要下载的文件！');
                    }
                    if (this.isOnlyFolder()) {
                        Swal.close(); return message.error('提示：请打开文件夹后勾选文件！');
                    }
            if (pt === 'home') {
                let queue = [];
                let token = this.getToken();
                if (!token.credentials || !token.credentials.access_token) {
                    return message.error('提示：登录凭证获取失败，请先登录网盘后刷新页面！');
                }
                selectList.forEach((item, index) => {
                    queue.push(this.getFileUrlByOnce(item, index, token));
                });
                const res = await Promise.all(queue);
                res.forEach(val => {
                    selectList[val.index].downloadUrl = val.downloadUrl;
                    if (val.mediaLink) selectList[val.index].mediaLink = val.mediaLink;
                });
            } else {
                let dialog = await Swal.fire({
                    toast: true,
                    icon: 'info',
                    title: `提示：请将文件<span class="tag-danger">[保存到网盘]</span>后前往<span class="tag-danger">[我的网盘]</span>中下载！`,
                    showConfirmButton: true,
                    confirmButtonText: '点击保存',
                    position: 'top',
                });
                if (dialog.isConfirmed) {
                    let save = document.querySelector('.saveToCloud');
                    save && save.click();
                    return;
                }
            }
            let html = this.generateDom(selectList);
            this.showMainDialog(pan[mode][0], html, pan[mode][1]);
        },
        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            list.forEach((v, i) => {
                if (v.kind === 'drive#folder') return;
                let filename = base.esc(v.name);
                let size = base.sizeFormat(+v.size);
                let dlink = v.downloadUrl;
                if (!/^https?:\/\//.test(dlink)) {
                    content += `<div class="pl-item"><div class="pl-item-name">${filename}</div><span class="pl-item-link pl-a" style="color:#cc3235">${base.esc(dlink)}</span></div>`;
                    return;
                }
                if (mode === 'api') {
                    content += `<div class="pl-item pl-row-api">
                                    <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                    <a class="pl-item-link listener-link-api" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}" data-index="${i}">${base.esc(dlink)}</a>
                                    <button class="pl-item-btn pl-btn-primary listener-idm" data-filename="${base.esc(filename)}" data-filesize="${+v.size}" data-link="${base.esc(dlink)}" data-index="${i}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IDM下载</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-copy" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制链接</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-api-btn" data-filename="${base.esc(filename)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制文件名</button>
                                    ${v.mediaLink ? `<button class="pl-item-link listener-link-media pl-btn-primary" data-filename="${base.esc(filename)}" data-link="${base.esc(v.mediaLink)}" data-index="${i}">云播转码下载(更小更快)</button>` : ''}
                                    </div>`;
                }
                if (mode === 'aria') {
                    let alink = this.convertLinkToAria(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                    <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                    <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制aria2c链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                    <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                    <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到 RPC 下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = this.convertLinkToCurl(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                    <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                    <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制curl链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'bc') {
                    let alink = this.convertLinkToBC(dlink, filename, navigator.userAgent);
                    content += `<div class="pl-item">
                                    <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                    <a class="pl-item-link" href="${base.esc(decodeURIComponent(alink))}" title="点击用比特彗星下载" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a>
                                    <div class="pl-item-btn listener-link-bc-btn" data-dlink="${dlink}">复制镜像地址</div>
                                    </div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button></div>`;
            if (mode === 'rpc') {
                let rpc = base.getValue('setting_rpc_domain') + ':' + base.getValue('setting_rpc_port') + base.getValue('setting_rpc_path');
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-send-rpc"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>发送全部链接</button><button title="${rpc}" class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置 RPC 参数（当前为：${rpc}）</button></div>`;
            }
            if (mode === 'curl')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button><button class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px;"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置终端类型（当前为：${terminalType[base.getValue('setting_terminal_type')] || '未知'}）</button></div>`;
            return content;
        },
        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: base.getValue('setting_rpc_domain'),
                port: base.getValue('setting_rpc_port'),
                path: base.getValue('setting_rpc_path'),
                token: base.getValue('setting_rpc_token'),
                dir: base.getValue('setting_rpc_dir'),
            };
            if (!base.validRpcDomain(rpc.domain)) {
                message.error('RPC主机无效，仅允许本机或内网地址（如 http://127.0.0.1）');
                return 'fail';
            }
            let url = `${rpc.domain}:${rpc.port}${rpc.path}`;
            let rpcData = {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [link], {
                    dir: rpc.dir,
                    out: base.safeRpcFilename(filename),
                    header: []
                }]
            };
            try {
                let res = await base.post(url, rpcData, {}, '');
                if (res.result) return 'success';
                // can tell a bad token from a bad dir instead of a generic "失败".
                message.error('aria2 拒绝请求：' + ((res.error && res.error.message) || '未知错误（请检查 RPC 密钥与保存路径）'));
                return 'fail';
            } catch (e) {
                message.error('无法连接 RPC（' + rpc.domain + ':' + rpc.port + '），请确认下载器已启动且 RPC 服务已开启');
                return 'fail';
            }
        },
        getSelectedList() {
            try {
                let doms = document.querySelectorAll('.SourceListItem__item--XxpOC');
                if (doms.length > 0) {
                    let selectedList = [];
                    for (let dom of doms) {
                        let domVue = dom.__vue__;
                        if (domVue && domVue.info && domVue.selected) {
                            if (domVue.selected.includes(domVue.info.id)) {
                                selectedList.push(domVue.info);
                            }
                        }
                    }
                    if (selectedList.length > 0) return selectedList;
                }
                let allItems = document.querySelectorAll('[class*="SourceListItem__item"]');
                if (allItems.length > 0) {
                    let selectedList = [];
                    for (let dom of allItems) {
                        let domVue = dom.__vue__;
                        if (domVue) {
                            let info = domVue.info || domVue.item || (domVue.$props && domVue.$props.info);
                            let selected = domVue.selected || domVue.fileSelected || (domVue.$props && domVue.$props.selected);
                            if (info && selected && selected.includes(info.id)) {
                                selectedList.push(info);
                            }
                        }
                    }
                    if (selectedList.length > 0) return selectedList;
                }
                let app = document.querySelector('#__nuxt') || document.querySelector('#app');
                if (app && app.__vue__) {
                    let rootVue = app.__vue__;
                    let found = this._findSelectedInVueTree(rootVue, 0);
                    if (found && found.length > 0) return found;
                }
                return [];
            } catch (e) {
                return [];
            }
        },
        _findSelectedInVueTree(vm, depth) {
            if (depth > 8 || !vm) return null;
            try {
                if (vm.fileSelected && vm.listInfo && Array.isArray(vm.fileSelected) && vm.fileSelected.length > 0) {
                    return vm.fileSelected.map(id => vm.listInfo[id]).filter(Boolean);
                }
                if (vm.$children) {
                    for (let child of vm.$children) {
                        let result = this._findSelectedInVueTree(child, depth + 1);
                        if (result && result.length > 0) return result;
                    }
                }
            } catch (e) {}
            return null;
        },
        detectPage() {
            let path = location.pathname;
            if (/^\/$/.test(path)) return 'home';
            return '';
        },
        isOnlyFolder() {
            for (let i = 0; i < selectList.length; i++) {
                if (selectList[i].kind === 'drive#file') return false;
            }
            return true;
        },
                showMainDialog(title, html, footer) {
                    return Swal.fire({
                        title,
                        html,
                        footer,
                        allowOutsideClick: false,
                        showCloseButton: true,
                        showConfirmButton: false,
                        position: 'top',
                        width,
                        padding: '15px 20px 5px',
                        customClass,
                        willClose: () => {
                            base._resetData();
                        },
                    });
                },
        async initPanLinker() {
            base.initDefaultConfig();
            base.addPanLinkerStyle();
            pt = this.detectPage();
            pan = LOCAL_CONFIG.xunlei;
            Object.freeze && Object.freeze(pan);
            this.addButton();
            base.createTip();
            base.registerMenuCommand();
        }
    };
    let quark = {
        convertLinkToAria(link, filename, ua) {
            filename = base.fixFilename(filename);
            return encodeURIComponent(`aria2c "${link}" --out "${filename}" -x 16 -s 16 -k 1M --header "Cookie: ${base.getCookie('__pus') || base.getCookie('__puus') || ''}"`);
        },
        convertLinkToBC(link, filename, ua) {
            // same as convertLinkToCurl — scope the cookie to what quark's CDN needs
            // instead of dumping the entire jar into a shareable link.
            const ck = base.getCookie('__pus') || base.getCookie('__puus') || '';
            let bc = `AA/${encodeURIComponent(filename)}/?url=${encodeURIComponent(link)}&cookie=${encodeURIComponent(ck)}ZZ`;
            return encodeURIComponent(`bc://http/${base.e(bc)}`);
        },
        convertLinkToCurl(link, filename, ua) {
            let terminal = base.getValue('setting_terminal_type');
            filename = base.fixFilename(filename);
            // this used to inline the whole document.cookie, dumping every session
            const ck = base.getCookie('__pus') || base.getCookie('__puus') || '';
            const cookie = ck ? ` -b "${ck}"` : '';
            return encodeURIComponent(`${terminal !== 'wp' ? 'curl' : 'curl.exe'} -L -C - "${link}" -o "${filename}"${cookie}`);
        },
        addPageListener() {
            if (this._listenerBound) return;
            this._listenerBound = true;
            window.addEventListener('hashchange', async (e) => {
                let home = 'https://pan.quark.cn/list#/', all = 'https://pan.quark.cn/list#/list/all';
                if (e.oldURL === home && e.newURL === all) return;
                await base.sleep(150);
                if ($('.quark-button').length > 0) return;
                this.addButton();
            });
            doc.on('click', '.pl-button-mode', async (e) => {
                            mode = e.target.dataset.mode;
                            Swal.showLoading();
                            try {
                                await this.getPCSLink();
                            } catch (err) {
                                Swal.close();
                                message.error('获取下载链接失败：' + (err && err.message || '未知错误'));
                            } finally {
                                // Swal.close() there can no longer strand the spinner and lock the page.
                                // No-op when the download dialog already replaced it.
                                if (document.querySelector('.swal2-popup.swal2-loading')) Swal.close();
                            }
                        });
            doc.on('click', '.listener-link-api', async (e) => {
                e.preventDefault();
base.iframeDownload(e.currentTarget.dataset.link);
            });
            doc.on('click', '.listener-link-aria, .listener-copy-all', (e) => {
                e.preventDefault();
                try { base.setClipboard(decodeURIComponent(e.target.dataset.link)); } catch(e) { base.setClipboard(e.target.dataset.link); }
                $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(base.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-open-setting', (e) => {
                e.preventDefault();
                e.stopPropagation();
                base.showSetting();
            });
        },
        addButton() {
            if (!pt) return;
            let $toolWrap;
            let $button = $(`<div class="quark-button pl-button"><svg width="22" height="22" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="#555" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 2-2z"/><path d="M14 8h1.553c.85 0 1.16.093 1.47.267.311.174.556.43.722.756.166.326.255.65.255 1.54v4.873c0 .892-.089 1.215-.255 1.54-.166.327-.41.583-.722.757-.31.174-.62.267-1.47.267H6.447c-.85 0-1.16-.093-1.47-.267a1.778 1.778 0 01-.722-.756c-.166-.326-.255-.65-.255-1.54v-4.873c0-.892.089-1.215.255-1.54.166-.327.41-.583.722-.757.31-.174.62-.267 1.47-.267H11"/><path stroke-linecap="round" stroke-linejoin="round" d="M11 3v10"/></g></svg><b>下载助手</b><ul class="pl-dropdown-menu"><li class="pl-dropdown-menu-item pl-button-mode" data-mode="api">API下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="aria" >Aria下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="rpc">RPC下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="curl">cURL下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="bc" >BC下载</li><li class="pl-dropdown-menu-item listener-open-setting">助手设置</li></ul></div>`);
            if (pt === 'home') {
                base.listenElement(pan.btn.home, () => {
                    $toolWrap = $(pan.btn.home);
                    $('.pl-button').length === 0 && $toolWrap.prepend($button);
                });
            }
        },
        async getPCSLink() {
                    selectList = this.getSelectedList();
                    if (selectList.length === 0) {
                        Swal.close(); return message.error('提示：请先勾选要下载的文件！');
                    }
                    if (this.isOnlyFolder()) {
                        Swal.close(); return message.error('提示：请打开文件夹后勾选文件！');
                    }
            let fids = [];
            selectList.forEach(val => {
                fids.push(val.fid);
            });
            if (pt === 'home') {
                let res = await base.post(pan.pcs[0], {
                    "fids": fids
                }, {"content-type": "application/json;charset=utf-8", "user-agent": pan.ua});
                if (res.code === 31001) {
                    Swal.close(); return message.error('提示：请先登录网盘！');
                }
                if (res.code !== 0) {
                                    return message.error('提示：获取链接失败！');
                                }
                                let html = this.generateDom(res.data);
            this.showMainDialog(pan[mode][0], html, pan[mode][1]);
                            } else {
                let dialog = await Swal.fire({
                    toast: true,
                    icon: 'info',
                    title: `提示：请将文件<span class="tag-danger">[保存到网盘]</span>后前往<span class="tag-danger">[我的网盘]</span>中下载！`,
                    showConfirmButton: true,
                    confirmButtonText: '点击保存',
                    position: 'top',
                });
                if (dialog.isConfirmed) {
                    let save = document.querySelector('.file-info_r');
                    save && save.click();
                    return;
                }
            }
        },
        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            list.forEach((v, i) => {
                if (v.file === false) return;
                let filename = base.esc(v.file_name);
                let fid = v.fid;
                let size = base.sizeFormat(v.size);
                let dlink = v.download_url;
                if (mode === 'api') {
                    content += `<div class="pl-item pl-row-api">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-api" data-fid="${fid}" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}" data-index="${i}">${base.esc(dlink)}</a>
                                <button class="pl-item-btn pl-btn-primary listener-idm" data-filename="${base.esc(filename)}" data-filesize="${v.size}" data-link="${base.esc(dlink)}" data-index="${i}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IDM下载</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-copy" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制链接</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-api-btn" data-filename="${base.esc(filename)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制文件名</button>
                                </div>`;
                }
                if (mode === 'aria') {
                    let alink = this.convertLinkToAria(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制aria2c链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到 RPC 下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = this.convertLinkToCurl(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制curl链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'bc') {
                    let alink = this.convertLinkToBC(dlink, filename, navigator.userAgent);
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link" href="${base.esc(decodeURIComponent(alink))}" title="点击用比特彗星下载" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button></div>`;
            if (mode === 'rpc') {
                let rpc = base.getValue('setting_rpc_domain') + ':' + base.getValue('setting_rpc_port') + base.getValue('setting_rpc_path');
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-send-rpc"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>发送全部链接</button><button title="${rpc}" class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置 RPC 参数（当前为：${rpc}）</button></div>`;
            }
            if (mode === 'curl')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button><button class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px;"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置终端类型（当前为：${terminalType[base.getValue('setting_terminal_type')] || '未知'}）</button></div>`;
            return content;
        },
        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: base.getValue('setting_rpc_domain'),
                port: base.getValue('setting_rpc_port'),
                path: base.getValue('setting_rpc_path'),
                token: base.getValue('setting_rpc_token'),
                dir: base.getValue('setting_rpc_dir'),
            };
            if (!base.validRpcDomain(rpc.domain)) {
                message.error('RPC主机无效，仅允许本机或内网地址（如 http://127.0.0.1）');
                return 'fail';
            }
            let url = `${rpc.domain}:${rpc.port}${rpc.path}`;
            let rpcData = {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [link], {
                    dir: rpc.dir,
                    out: base.safeRpcFilename(filename),
                    header: [`Cookie: ${base.getCookie('__pus') || base.getCookie('__puus') || ''}`]
                }]
            };
            try {
                let res = await base.post(url, rpcData, {}, '');
                if (res.result) return 'success';
                // can tell a bad token from a bad dir instead of a generic "失败".
                message.error('aria2 拒绝请求：' + ((res.error && res.error.message) || '未知错误（请检查 RPC 密钥与保存路径）'));
                return 'fail';
            } catch (e) {
                message.error('无法连接 RPC（' + rpc.domain + ':' + rpc.port + '），请确认下载器已启动且 RPC 服务已开启');
                return 'fail';
            }
        },
        getSelectedList() {
            try {
                let selectedList = [];
                let reactDom = document.getElementsByClassName('file-list')[0];
                let reactObj = base.findReact(reactDom);
                if (!reactObj) return [];
                let props = reactObj.props;
                if (props) {
                    let fileList = props.list || [];
                    let selectedKeys = props.selectedRowKeys || [];
                    fileList.forEach((val) => {
                        if (selectedKeys.includes(val.fid)) {
                            selectedList.push(Object.assign({}, val));
                        }
                    });
                }
                return selectedList;
            } catch (e) {
                return [];
            }
        },
        detectPage() {
            // CDP-verified: live href is /list#/list/all, so location.pathname already
            let path = location.pathname;
            if (/^\/(list)/.test(path)) return 'home';
            return '';
        },
        isOnlyFolder() {
            for (let i = 0; i < selectList.length; i++) {
                if (selectList[i].file) return false;
            }
            return true;
        },
                showMainDialog(title, html, footer) {
                    return Swal.fire({
                        title,
                        html,
                        footer,
                        allowOutsideClick: false,
                        showCloseButton: true,
                        showConfirmButton: false,
                        position: 'top',
                        width,
                        padding: '15px 20px 5px',
                        customClass,
                        willClose: () => {
                            base._resetData();
                        },
                    });
                },
        async initPanLinker() {
            base.initDefaultConfig();
            base.addPanLinkerStyle();
            pt = this.detectPage();
            pan = LOCAL_CONFIG.quark;
            Object.freeze && Object.freeze(pan);
            this.addButton();
            this.addPageListener();
            base.createTip();
            base.registerMenuCommand();
        }
    };
    let yidong = {
        convertLinkToAria(link, filename, ua) {
            filename = base.fixFilename(filename);
            return encodeURIComponent(`aria2c "${link}" --out "${filename}" -x 16 -s 16 -k 1M`);
        },
        convertLinkToBC(link, filename, ua) {
            let bc = `AA/${encodeURIComponent(filename)}/?url=${encodeURIComponent(link)}ZZ`;
            return encodeURIComponent(`bc://http/${base.e(bc)}`);
        },
        convertLinkToCurl(link, filename, ua) {
            let terminal = base.getValue('setting_terminal_type');
            filename = base.fixFilename(filename);
            return encodeURIComponent(`${terminal !== 'wp' ? 'curl' : 'curl.exe'} -L -C - "${link}" -o "${filename}"`);
        },
        addPageListener() {
                    doc.on('click', '.pl-button-mode', async (e) => {
                        mode = e.target.dataset.mode;
                        Swal.showLoading();
                        try {
                            await this.getPCSLink();
                        } catch (err) {
                            Swal.close();
                            message.error('获取下载链接失败：' + (err && err.message || '未知错误'));
                        } finally {
                            // Swal.close() there can no longer strand the spinner and lock the page.
                            // No-op when the download dialog already replaced it.
                            if (document.querySelector('.swal2-popup.swal2-loading')) Swal.close();
                        }
                    });
            doc.on('click', '.listener-link-api', async (e) => {
                e.preventDefault();
base.iframeDownload(e.currentTarget.dataset.link);
            });
            doc.on('click', '.listener-link-aria, .listener-copy-all', (e) => {
                e.preventDefault();
                try { base.setClipboard(decodeURIComponent(e.target.dataset.link)); } catch(e) { base.setClipboard(e.target.dataset.link); }
                $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(base.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-open-setting', (e) => {
                e.preventDefault();
                e.stopPropagation();
                base.showSetting();
            });
        },
        addButton() {
            if (!pt) return;
            let $toolWrap;
            let $button = $(`<div class="yidong-button pl-button">下载助手<ul class="pl-dropdown-menu" style="top: 36px;"><li class="pl-dropdown-menu-item pl-button-mode" data-mode="api">API下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="aria" >Aria下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="rpc">RPC下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="curl">cURL下载</li><li class="pl-dropdown-menu-item pl-button-mode" data-mode="bc" >BC下载</li><li class="pl-dropdown-menu-item listener-open-setting">助手设置</li></ul></div>`);
            if (pt === 'home') {
                base.listenElement(pan.btn.home, () => {
                    $toolWrap = $(pan.btn.home);
                    $('.pl-button').length === 0 && $toolWrap.prepend($button);
                })
            }
            this.addPageListener();
        },
        async getFileUrlByOnce(item, index) {
            try {
                if (item.downloadUrl) return {
                    index,
                    downloadUrl: item.downloadUrl
                };
                if (this.detectPage() === 'home') {
                    let body = {
                        "fileId": item.contentID
                    };
                    let time = new Date(+new Date() + 8 * 3600 * 1000).toJSON().substr(0, 19).replace('T', ' ');
                    let key = base.getRandomString(16);
                    let sign = base.getSign(undefined, body, time, key);
                    let res = await base.post(pan.pcs[0], body, {
                        'authorization': base.getCookie('authorization'),
                        'caller': 'web',
                        'content-type': "application/json;charset=UTF-8",
                        'CMS-DEVICE': 'default',
                        'mcloud-channel': '1000101',
                        'mcloud-client': '10701',
                        'mcloud-sign': time + "," + key + "," + sign,
                        'mcloud-version': '7.14.2',
                        'x-deviceinfo': '||9|7.17.0|edge||||windows 10||zh-CN|||',
                        'x-huawei-channelsrc': '10000034',
                        'x-inner-ntwk': '2',
                        'x-m4c-caller': 'PC',
                        'x-m4c-src': '10002',
                        'x-svctype': '1',
                        'x-yun-api-version': 'v1',
                        'x-yun-app-channel': '10000034',
                        'x-yun-channel-source': '10000034',
                        'x-yun-client-info': '||9|7.17.0|edge||||windows 10||zh-CN|||||',
                        'x-yun-module-type': '100',
                        'x-yun-svc-type': '1',
                        'x-yun-url-type': '3',
                    });
                    if (res.success) {
                        return {
                            index,
                            downloadUrl: res.data.url
                        };
                    } else {
                        return {
                            index,
                            downloadUrl: '获取下载地址失败，请刷新重试！'
                        };
                    }
                }
                let res = await base.post(pan.pcs[1], `linkId=${vueDom.linkID}&contentIds=${encodeURIComponent(item.path)}&catalogIds=`, {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    });
                    if (res.code === 0) {
                        return {
                            index,
                            downloadUrl: res.data.redrUrl
                        };
                    } else {
                        return {
                            index,
                            downloadUrl: '获取下载地址失败，请刷新重试！'
                        };
                    }
            } catch (e) {
                return {
                    index,
                    downloadUrl: '获取下载地址失败，请刷新重试！'
                };
            }
        },
        async getPCSLink() {
            selectList = this.getSelectedList();
            if (selectList.length === 0) {
                Swal.close(); return message.error('提示：请先勾选要下载的文件！');
            }
            if (this.isOnlyFolder()) {
                return message.error('提示：勾选的全是文件夹，脚本仅支持下载文件，请打开文件夹后勾选文件！');
            }
            selectList = selectList.filter(v => v && v.contentID);
            if (selectList.length === 0) {
                return message.error('提示：未获取到文件标识，请刷新页面后重试！');
            }
            let queue = [];
            selectList.forEach((item, index) => {
                queue.push(this.getFileUrlByOnce(item, index));
            });
            const res = await Promise.all(queue);
            res.forEach(val => {
                selectList[val.index].downloadUrl = val.downloadUrl;
            });
            let html = this.generateDom(selectList);
            this.showMainDialog(pan[mode][0], html, pan[mode][1]);
        },
        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            list.forEach((v, i) => {
                if (v.dirEtag || v.caName) return;
                let filename = base.esc(v.contentName || v.coName);
                let size = base.sizeFormat(v.contentSize || v.coSize);
                let dlink = v.downloadUrl;
                if (!/^https?:\/\//.test(dlink)) {
                    content += `<div class="pl-item"><div class="pl-item-name">${filename}</div><span class="pl-item-link pl-a" style="color:#cc3235">${base.esc(dlink)}</span></div>`;
                    return;
                }
                if (mode === 'api') {
                    content += `<div class="pl-item pl-row-api">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-api" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}" data-index="${i}">${base.esc(dlink)}</a>
                                <button class="pl-item-btn pl-btn-primary listener-idm" data-filename="${base.esc(filename)}" data-filesize="${(v.contentSize || v.coSize)}" data-link="${base.esc(dlink)}" data-index="${i}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>IDM下载</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-copy" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制链接</button>

                                <button class="pl-item-btn pl-btn-primary listener-link-api-btn" data-filename="${base.esc(filename)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制文件名</button>
                                </div>`;
                }
                if (mode === 'aria') {
                    let alink = this.convertLinkToAria(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制aria2c链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${base.esc(filename)}" data-link="${base.esc(dlink)}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到 RPC 下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = this.convertLinkToCurl(dlink, filename, navigator.userAgent);
                    alinkAllText += alink + '\r\n';
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${base.esc(alink)}" title="点击复制curl链接" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
                if (mode === 'bc') {
                    let alink = this.convertLinkToBC(dlink, filename, navigator.userAgent);
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link" href="${base.esc(decodeURIComponent(alink))}" title="点击用比特彗星下载" data-filename="${base.esc(filename)}" data-link="${base.esc(alink)}">${base.esc(decodeURIComponent(alink))}</a> </div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button></div>`;
            if (mode === 'rpc') {
                let rpc = base.getValue('setting_rpc_domain') + ':' + base.getValue('setting_rpc_port') + base.getValue('setting_rpc_path');
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-send-rpc"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>发送全部链接</button><button title="${rpc}" class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置 RPC 参数（当前为：${rpc}）</button></div>`;
            }
            if (mode === 'curl')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-all" data-link="${base.esc(alinkAllText)}"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制全部链接</button><button class="pl-btn-primary pl-btn-warning listener-open-setting" style="margin-left: 10px;"><svg class="pl-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置终端类型（当前为：${terminalType[base.getValue('setting_terminal_type')] || '未知'}）</button></div>`;
            return content;
        },
        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: base.getValue('setting_rpc_domain'),
                port: base.getValue('setting_rpc_port'),
                path: base.getValue('setting_rpc_path'),
                token: base.getValue('setting_rpc_token'),
                dir: base.getValue('setting_rpc_dir'),
            };
            if (!base.validRpcDomain(rpc.domain)) {
                message.error('RPC主机无效，仅允许本机或内网地址（如 http://127.0.0.1）');
                return 'fail';
            }
            let url = `${rpc.domain}:${rpc.port}${rpc.path}`;
            let rpcData = {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [link], {
                    dir: rpc.dir,
                    out: base.safeRpcFilename(filename),
                    header: []
                }]
            };
            try {
                let res = await base.post(url, rpcData, {}, '');
                if (res.result) return 'success';
                // can tell a bad token from a bad dir instead of a generic "失败".
                message.error('aria2 拒绝请求：' + ((res.error && res.error.message) || '未知错误（请检查 RPC 密钥与保存路径）'));
                return 'fail';
            } catch (e) {
                message.error('无法连接 RPC（' + rpc.domain + ':' + rpc.port + '），请确认下载器已启动且 RPC 服务已开启');
                return 'fail';
            }
        },
        getSelectedList() {
            let normalize = (item, vue) => {
                if (!item || typeof item !== 'object') return null;
                if (!item.owner && vue) {
                    try {
                        let root = vue.$root || vue;
                        let s = root && root.$data;
                        if (s) {
                            let owner = s.owner || s.account ||
                                (s.userInfo && (s.userInfo.account || s.userInfo.phone)) ||
                                (s.globalInfo && (s.globalInfo.account || s.globalInfo.phone)) || '';
                            if (owner) item.owner = owner;
                        }
                    } catch (e) {}
                }
                return item;
            };
            let result = [];
            try {
                let vue = document.querySelector(".main_file_list").__vue__;
                let list = vue.selectList;
                if (Array.isArray(list) && list.length) {
                    result = list.map(val => normalize(val.item, vue)).filter(Boolean);
                    if (result.length) return result;
                }
            } catch (e) {}
            try {
                let vueDom = document.querySelector(".home-page").__vue__;
                let fileList = vueDom._computedWatchers.fileList.value;
                let dirList = vueDom._computedWatchers.dirList.value;
                let selectedFileIndex = vueDom.selectedFile;
                let selectedDirIndex = vueDom.selectedDir;
                let selectFileList = fileList.filter((v, i) => {
                    return selectedFileIndex.includes(i);
                });
                let selectDirList = dirList.filter((v, i) => {
                    return selectedDirIndex.includes(i);
                });
                let list = [...selectFileList, ...selectDirList];
                if (list.length) {
                    result = list.map(v => normalize(v, vueDom)).filter(Boolean);
                    if (result.length) return result;
                }
            } catch (e) {}
            try {
                let containers = document.querySelectorAll('.main_file_list, [class*="file-list"], [class*="fileList"], .file-box, .home-page');
                let markSelectors = ['[class*="selected"]', '[class*="checked"]', 'input[type="checkbox"]:checked'];
                containers.forEach(container => {
                    markSelectors.forEach(sel => {
                        container.querySelectorAll(sel).forEach(dom => {
                            let vue = dom.__vue__ || (dom.parentElement && dom.parentElement.__vue__) ||
                                (dom.closest && dom.closest('[class*="item"]') && dom.closest('[class*="item"]').__vue__);
                            if (!vue) return;
                            let item = vue.item || vue.fileData || vue.info ||
                                (vue.$props && (vue.$props.item || vue.$props.file || vue.$props.data));
                            if (!item && vue.$data) {
                                item = vue.$data.item || vue.$data.fileData || vue.$data.info;
                            }
                            item = normalize(item, vue);
                            if (item && !result.includes(item)) result.push(item);
                        });
                    });
                });
                if (result.length) return result;
            } catch (e) {}
            return [];
        },
        detectPage() {
            let path = location.pathname;
            if (/^\/w/.test(path)) return 'home';
            return '';
        },
        isOnlyFolder() {
            for (let i = 0; i < selectList.length; i++) {
                let v = selectList[i] || {};
                if (v.kind === 'folder' || v.folder === true || v.isFolder === true || v.contentType === 'folder' || v.contentType === 'dir') continue;
                return false;
            }
            return true;
        },
                showMainDialog(title, html, footer) {
                    return Swal.fire({
                        title,
                        html,
                        footer,
                        allowOutsideClick: false,
                        showCloseButton: true,
                        showConfirmButton: false,
                        position: 'top',
                        width,
                        padding: '15px 20px 5px',
                        customClass,
                        willClose: () => {
                            base._resetData();
                        },
                    });
                },
        async initPanLinker() {
            base.initDefaultConfig();
            base.addPanLinkerStyle();
            pt = this.detectPage();
            pan = LOCAL_CONFIG.yidong;
            Object.freeze && Object.freeze(pan);
            this.addButton();
            base.createTip();
            base.registerMenuCommand();
        }
    };
    let main = {
        init() {
            base.migrate();
            if (/(pan|yun).baidu.com/.test(location.host)) {
                baidu.initPanLinker();
            }
            if (/openapi.baidu.com\/oauth/.test(location.href)) {
                baidu.initAuthorize()
            }
            if (/www.(aliyundrive|alipan).com/.test(location.host)) {
                ali.initPanLinker();
            }
            if (/cloud.189.cn/.test(location.host)) {
                tianyi.initPanLinker();
            }
            if (/pan.xunlei.com/.test(location.host)) {
                xunlei.initPanLinker();
            }
            if (/pan.quark.cn/.test(location.host)) {
                quark.initPanLinker();
            }
            if (/(yun|caiyun).139.com/.test(location.host)) {
                yidong.initPanLinker();
            }
        }
    };
main.init();
})();
