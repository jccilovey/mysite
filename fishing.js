/**
 * 钓鱼字卡小游戏
 * 与 game-room.js 配合，通过 global._fishingOpen() 打开
 */
(function (global) {
    'use strict';

    var 默认鱼池 = [
        "🐟","🐠","🐡","🦈","🐙","🦑","🐬","🐳","🦐","🦀"
    ];

    function 取字池() {
        try {
            if (typeof global.字卡库 !== 'undefined' && Array.isArray(global.字卡库)) return global.字卡库;
            if (typeof global.CARD_POOL !== 'undefined' && Array.isArray(global.CARD_POOL)) return global.CARD_POOL;
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                var v = localStorage.getItem(k);
                if (!v || v.length < 50) continue;
                try {
                    var parsed = JSON.parse(v);
                    if (Array.isArray(parsed) && parsed.length > 5 && typeof parsed[0] === 'string') return parsed;
                    if (parsed && Array.isArray(parsed.customReplies)) return parsed.customReplies;
                } catch (e) {}
            }
        } catch (e) {}
        return ["一","二","三","四","五","日","月","水","火","木"];
    }

    var 字池 = 取字池();
    var 鱼池权重 = 90;
    var 字池权重 = 10;

    var 指针速度 = 0.9;
    var 完美区钓鱼概率 = 0.80;
    var 一般区钓鱼概率 = 0.35;
    var 失败区钓鱼概率 = 0.00;
    var 完美区起点 = 0.75;
    var 一般区起点 = 0.40;

    var score = 0;
    var isCasting = false;
    var hookActive = false;
    var currentHookX = 450, currentHookY = 60;
    var bobberX = 450, bobberY = 200;
    var ripples = [];
    var canvas, ctx, cardDisplay, scoreSpan, castBtn, waterArea, judgePanel, judgePointer, judgeHint, judgeStopBtn;
    var CANVAS_W = 600, CANVAS_H = 360;
    var judgeTimer = null;

    global._fishingOpen = function () {
        var html = ''
            + '<div id="fishing-game" style="position:fixed;inset:0;z-index:9999;background:linear-gradient(145deg,#0b2b3f,#1b4f6e);display:flex;flex-direction:column;align-items:center;padding:20px;box-sizing:border-box;overflow:auto;">'
            +   '<div style="width:100%;max-width:640px;">'
            +     '<div style="display:flex;align-items:center;margin-bottom:12px;">'
            +       '<button id="fishing-back" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;">←</button>'
            +       '<h2 style="color:#ffe9b6;margin:0;flex:1;text-align:center;font-size:1.2rem;letter-spacing:2px;">🎣 钓鱼字卡</h2>'
            +       '<div style="width:40px;"></div>'
            +     '</div>'
            +     '<div id="fish-water" style="position:relative;width:100%;aspect-ratio:600/360;background:radial-gradient(circle at 20% 30%,#3e8ba3,#1a4e62);border-radius:20px 20px 40px 40px;box-shadow:inset 0 10px 20px #00000055,0 8px 0 #0b222b;overflow:hidden;cursor:pointer;border:2px solid #81c4d0;">'
            +       '<canvas id="fish-canvas" width="600" height="360" style="display:block;width:100%;height:100%;"></canvas>'
            +     '</div>'
            +     '<div id="fish-judge" style="display:none;margin-top:12px;background:#0d2633;border-radius:20px;padding:10px 14px;box-shadow:inset 0 3px 8px #00000066;position:relative;">'
            +       '<div style="position:relative;height:28px;background:#1f3f4f;border-radius:20px;overflow:hidden;border:2px solid #81c4d0;">'
            +         '<div style="position:absolute;left:0;top:0;bottom:0;width:40%;background:linear-gradient(90deg,#6b1d1d,#a33);opacity:0.8;"></div>'
            +         '<div style="position:absolute;left:40%;top:0;bottom:0;width:35%;background:linear-gradient(90deg,#b8860b,#daa520);opacity:0.85;"></div>'
            +         '<div style="position:absolute;left:75%;top:0;bottom:0;width:25%;background:linear-gradient(90deg,#2e8b57,#3cb371);opacity:0.9;"></div>'
            +         '<div style="position:absolute;left:0;top:0;bottom:0;width:40%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">失败</div>'
            +         '<div style="position:absolute;left:40%;top:0;bottom:0;width:35%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">一般</div>'
            +         '<div style="position:absolute;left:75%;top:0;bottom:0;width:25%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">完美</div>'
            +       '</div>'
            +       '<div id="fish-pointer" style="position:absolute;top:2px;left:0%;width:6px;height:44px;background:#fff;border-radius:4px;box-shadow:0 0 12px #fff,0 0 20px #ffd966;transform:translateX(-50%);"></div>'
            +       '<div id="fish-hint" style="text-align:center;margin-top:8px;color:#b3e0ff;font-size:13px;">点击「收线」停下指针！</div>'
            +       '<button id="fish-stop" style="width:100%;margin-top:10px;background:#ffb347;border:none;border-bottom:6px solid #a05f1a;padding:12px;font-size:1.15rem;font-weight:700;border-radius:50px;color:#201508;cursor:pointer;">🎣 收线！</button>'
            +     '</div>'
            +     '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;gap:1rem;">'
            +       '<div id="fish-card" style="background:#fef8e7;padding:0.5rem 1rem;border-radius:30px;box-shadow:inset 0 -4px 0 #bba88a,0 8px 12px #00000055;font-size:1.4rem;font-weight:800;color:#0e2b36;min-width:110px;min-height:70px;display:flex;align-items:center;justify-content:center;border:3px solid #ebd5b3;text-align:center;padding:8px;word-break:break-all;">🐟</div>'
            +       '<div style="background:#0d2c38d0;padding:0.4rem 1rem;border-radius:60px;color:#daecf5;font-weight:600;">🎣 钓获 <span id="fish-score" style="background:#0c1e27;padding:0.2rem 0.8rem;border-radius:30px;color:#ffd966;font-size:1.2rem;">0</span></div>'
            +     '</div>'
            +     '<button id="fish-cast" style="width:100%;margin-top:12px;background:#ffb347;border:none;border-bottom:6px solid #a05f1a;padding:0.75rem;font-size:1.1rem;font-weight:700;border-radius:50px;color:#201508;cursor:pointer;">🎣 抛竿钓鱼</button>'
            +   '</div>'
            + '</div>';

        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        document.body.appendChild(wrap.firstChild);

        canvas = document.getElementById('fish-canvas');
        ctx = canvas.getContext('2d');
        cardDisplay = document.getElementById('fish-card');
        scoreSpan = document.getElementById('fish-score');
        castBtn = document.getElementById('fish-cast');
        waterArea = document.getElementById('fish-water');
        judgePanel = document.getElementById('fish-judge');
        judgePointer = document.getElementById('fish-pointer');
        judgeHint = document.getElementById('fish-hint');
        judgeStopBtn = document.getElementById('fish-stop');

        document.getElementById('fishing-back').addEventListener('click', function () {
            var el = document.getElementById('fishing-game');
            if (el) el.remove();
            if (judgeTimer) cancelAnimationFrame(judgeTimer);
            if (typeof global._gameRoomRender === 'function') global._gameRoomRender();
        });

        waterArea.addEventListener('click', function () {
            if (isCasting) return;
            if (!hookActive) { 抛竿(); return; }
            hookActive = false;
            启动判定条();
        });
        castBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (isCasting || hookActive) return;
            抛竿();
        });
        judgeStopBtn.addEventListener('click', 停止并结算);

        requestAnimationFrame(绘制);
    };

    function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function 抽一张卡() {
        if (!字池 || 字池.length === 0) {
            return { 类型: '鱼', 内容: 默认鱼池[Math.floor(Math.random() * 默认鱼池.length)] };
        }
        var 总权重 = 鱼池权重 + 字池权重;
        var 随机值 = Math.random() * 总权重;
        if (随机值 < 鱼池权重) {
            return { 类型: '鱼', 内容: 默认鱼池[Math.floor(Math.random() * 默认鱼池.length)] };
        } else {
            return { 类型: '字', 内容: 字池[Math.floor(Math.random() * 字池.length)] };
        }
    }

    function 显示卡片(卡片) {
        cardDisplay.textContent = 卡片.内容;
        if (卡片.类型 === '字') {
            cardDisplay.style.borderColor = '#ffd966';
            cardDisplay.style.boxShadow = 'inset 0 -4px 0 #bba88a,0 8px 12px #00000055,0 0 20px #ffd966';
        } else {
            cardDisplay.style.borderColor = '#ebd5b3';
            cardDisplay.style.boxShadow = 'inset 0 -4px 0 #bba88a,0 8px 12px #00000055';
        }
    }

    function 钓到卡() {
        var 卡片 = 抽一张卡();
        显示卡片(卡片);
        score++;
        scoreSpan.textContent = score;
        for (var i = 0; i < 6; i++) {
            ripples.push({
                x: bobberX + (Math.random() - 0.5) * 50,
                y: bobberY + (Math.random() - 0.5) * 30,
                radius: 5 + Math.random() * 20,
                maxRadius: 40 + Math.random() * 30,
                alpha: 0.9, life: 1.0
            });
        }
    }

    function 抛竿() {
        if (isCasting) return;
        var sx = currentHookX, sy = currentHookY;
        var tx = randomInt(180, 500), ty = randomInt(120, 280);
        isCasting = true; hookActive = false;
        var duration = 550, start = performance.now();
        function anim(now) {
            var t = Math.min((now - start) / duration, 1);
            t = 1 - (1 - t) * (1 - t);
            currentHookX = sx + (tx - sx) * t;
            currentHookY = sy + (ty - sy) * t;
            bobberX = currentHookX;
            bobberY = Math.min(currentHookY + 38, CANVAS_H - 30);
            if (t < 1) requestAnimationFrame(anim);
            else {
                isCasting = false; hookActive = true;
                for (var i = 0; i < 5; i++) {
                    ripples.push({
                        x: tx + (Math.random() - 0.5) * 40,
                        y: ty + (Math.random() - 0.5) * 20,
                        radius: 6 + Math.random() * 12,
                        maxRadius: 30 + Math.random() * 30,
                        alpha: 0.8, life: 1
                    });
                }
            }
        }
        requestAnimationFrame(anim);
    }

    function 收杆() {
        if (isCasting) return;
        var sx = currentHookX, sy = currentHookY;
        var ex = 470, ey = 60;
        var duration = 400, start = performance.now();
        isCasting = true; hookActive = false;
        function anim(now) {
            var t = Math.min((now - start) / duration, 1);
            t = 1 - Math.pow(1 - t, 3);
            currentHookX = sx + (ex - sx) * t;
            currentHookY = sy + (ey - sy) * t;
            bobberX = currentHookX;
            bobberY = Math.min(currentHookY + 40, CANVAS_H - 40);
            if (t < 1) requestAnimationFrame(anim);
            else {
                isCasting = false;
                currentHookX = 450; currentHookY = 60;
                ripples.push({ x: 450, y: 100, radius: 10, maxRadius: 70, alpha: 0.7, life: 1 });
            }
        }
        requestAnimationFrame(anim);
    }

    var 指针位置 = 0, 指针方向 = 1, 判定运行中 = false;

    function 启动判定条() {
        if (判定运行中) return;
        判定运行中 = true;
        指针位置 = 0; 指针方向 = 1;
        judgePanel.style.display = 'block';
        judgeHint.textContent = '点击「收线」停下指针！';
        judgeStopBtn.disabled = false;
        judgeStopBtn.style.opacity = '1';
        function 移动() {
            if (!判定运行中) return;
            指针位置 += 指针方向 * 指针速度 * 0.012;
            if (指针位置 >= 1) { 指针位置 = 1; 指针方向 = -1; }
            else if (指针位置 <= 0) { 指针位置 = 0; 指针方向 = 1; }
            judgePointer.style.left = (指针位置 * 100) + '%';
            judgeTimer = requestAnimationFrame(移动);
        }
        judgeTimer = requestAnimationFrame(移动);
    }

    function 停止并结算() {
        if (!判定运行中) return;
        判定运行中 = false;
        cancelAnimationFrame(judgeTimer);
        judgeStopBtn.disabled = true;
        judgeStopBtn.style.opacity = '0.6';

        var 区域 = '', 概率 = 0;
        if (指针位置 >= 完美区起点) { 区域 = '完美'; 概率 = 完美区钓鱼概率; }
        else if (指针位置 >= 一般区起点) { 区域 = '一般'; 概率 = 一般区钓鱼概率; }
        else { 区域 = '失败'; 概率 = 失败区钓鱼概率; }

        var 真的钓到 = Math.random() < 概率;
        if (区域 === '完美') judgeHint.textContent = 真的钓到 ? '✨ 完美！上钩了！' : '💔 完美时机，鱼却溜了…';
        else if (区域 === '一般') judgeHint.textContent = 真的钓到 ? '🎣 一般命中，居然钓到了！' : '😢 一般命中，鱼跑了…';
        else judgeHint.textContent = '❌ 时机不对，鱼跑了！';

        setTimeout(function () {
            if (真的钓到) { 钓到卡(); 收杆(); }
            else { 收杆(); }
            setTimeout(function () { judgePanel.style.display = 'none'; }, 800);
        }, 600);
    }

    function 绘制() {
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        var grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        grad.addColorStop(0, '#4499b3');
        grad.addColorStop(0.7, '#206b82');
        grad.addColorStop(1, '#0d3a4b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        for (var i = 0; i < 8; i++) {
            var y = 30 + i * 40 + Math.sin(Date.now() * 0.002 + i) * 5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(150, y + 10, 300, y - 15, CANVAS_W, y + 5);
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.05 + i * 0.01) + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ripples = ripples.filter(function (r) { return r.life > 0.02; });
        for (var j = 0; j < ripples.length; j++) {
            var r = ripples[j];
            r.radius += 0.9; r.life *= 0.96; r.alpha = r.life * 0.8;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,240,' + r.alpha + ')';
            ctx.lineWidth = 2.5 * r.life;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(520, 40);
        ctx.lineTo(currentHookX, currentHookY);
        ctx.strokeStyle = '#d4eefc';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(currentHookX, currentHookY - 6, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#e63946';
        ctx.shadowColor = '#fff0b0';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(currentHookX, currentHookY - 10, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fdfdff';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(currentHookX, currentHookY);
        ctx.lineTo(currentHookX - 5, currentHookY + 12);
        ctx.lineTo(currentHookX + 5, currentHookY + 12);
        ctx.closePath();
        ctx.fillStyle = '#c0c0c0';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (hookActive && !isCasting) {
            ctx.beginPath();
            ctx.arc(currentHookX, currentHookY, 22 + Math.sin(Date.now() * 0.01) * 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#fffacd';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f0e68c';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        requestAnimationFrame(绘制);
    }

})(window);