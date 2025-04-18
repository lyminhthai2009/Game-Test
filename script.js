const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- DOM Elements ---
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnTurretUp = document.getElementById('btn-turret-up');
const btnTurretDown = document.getElementById('btn-turret-down');
const btnFire = document.getElementById('btn-fire'); // Nút bắn
const levelDisplay = document.getElementById('level-display');
const messageDisplay = document.getElementById('message-display');

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = []; // Mảng chứa các viên đạn đang bay
let target = { x: 0, y: 0, width: 0, height: 0, isHit: false, color: '#337AB7' }; // Màu xanh dương
let obstacles = []; // Mảng chứa chướng ngại vật
let wind = 0; // Lực gió (ảnh hưởng theo chiều ngang)
let gameOver = false;
let levelComplete = false;

const gravity = 0.15; // Gia tốc trọng trường (điều chỉnh để có độ nảy phù hợp)
const initialBulletVelocity = 10; // Vận tốc ban đầu của đạn (điều chỉnh)

// --- Tank Definition ---
const tank = {
    x: 50, // Vị trí X ban đầu
    y: 0,
    width: 50,
    height: 25,
    color: '#D9534F',
    speed: 2,
    turret: {
        length: 35,
        width: 8,
        angle: -Math.PI / 6,
        color: '#5CB85C',
        angleSpeed: 0.03,
        // Điểm gốc của nòng súng so với thân xe (để tính vị trí đạn bắn ra)
        pivotXOffset: 25, // Nửa chiều rộng thân xe
        pivotYOffset: 0   // Ngay trên đỉnh thân xe
    },
    isMovingLeft: false,
    isMovingRight: false,
    isTurretMovingUp: false,
    isTurretMovingDown: false,
    canFire: true, // Cho phép bắn
    fireCooldown: 500, // Thời gian chờ giữa các lần bắn (ms)
};

// --- Level Definitions ---
const levels = [
    // Level 1: Dễ
    { target: { xRatio: 0.7, yRatio: 0.6, width: 40, height: 40 }, obstacles: [], wind: 0 },
    // Level 2: Xa hơn, nhỏ hơn
    { target: { xRatio: 0.85, yRatio: 0.4, width: 30, height: 30 }, obstacles: [], wind: 0.01 }, // Gió nhẹ
    // Level 3: Có vật cản
    { target: { xRatio: 0.6, yRatio: 0.3, width: 25, height: 25 }, obstacles: [{ xRatio: 0.45, yRatio: 0.7, width: 20, height: 100, color: '#A9A9A9' }], wind: -0.01 }, // Gió ngược nhẹ
    // Level 4: Vật cản khác, mục tiêu nhỏ hơn
    { target: { xRatio: 0.9, yRatio: 0.2, width: 20, height: 20 }, obstacles: [{ xRatio: 0.7, yRatio: 0.5, width: 80, height: 20, color: '#A9A9A9' }], wind: 0.02 },
    // Level 5: Cực khó
    { target: { xRatio: 0.95, yRatio: 0.1, width: 15, height: 15 }, obstacles: [{ xRatio: 0.3, yRatio: 0.4, width: 20, height: 150, color: '#696969' }, { xRatio: 0.65, yRatio: 0.6, width: 100, height: 20, color: '#696969' }], wind: 0.05 }, // Gió mạnh
    // Thêm các level khó hơn nữa ở đây...
    { target: { xRatio: 0.1, yRatio: 0.15, width: 15, height: 15 }, obstacles: [{ xRatio: 0.5, yRatio: 0.5, width: 20, height: 250, color: '#696969' }], wind: -0.06 }, // Bắn ngược, gió ngược mạnh
];

// --- Drawing Functions ---
function drawTank() {
    // Thân xe
    ctx.fillStyle = tank.color;
    ctx.fillRect(tank.x, tank.y - tank.height, tank.width, tank.height);

    // Nòng súng
    ctx.save();
    const pivotX = tank.x + tank.turret.pivotXOffset;
    const pivotY = tank.y - tank.height + tank.turret.pivotYOffset;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tank.turret.angle);
    ctx.fillStyle = tank.turret.color;
    ctx.fillRect(0, -tank.turret.width / 2, tank.turret.length, tank.turret.width);
    ctx.restore();
}

function drawBullets() {
    ctx.fillStyle = '#333'; // Màu đạn đen
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawTarget() {
    if (!target.isHit) {
        ctx.fillStyle = target.color;
        ctx.fillRect(target.x, target.y - target.height, target.width, target.height);
        // Vẽ biểu tượng ngôi sao vàng bên trong mục tiêu (tùy chọn)
        drawStar(target.x + target.width / 2, target.y - target.height / 2, 5, target.width * 0.3, target.width * 0.15);
    }
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y - obstacle.height, obstacle.width, obstacle.height);
    });
}

// Hàm vẽ ngôi sao (cho mục tiêu)
function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius)
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y)
        rot += step

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y)
        rot += step
    }
    ctx.lineTo(cx, cy - outerRadius)
    ctx.closePath();
    ctx.lineWidth=1;
    ctx.strokeStyle='gold'; // Viền vàng
    ctx.stroke();
    ctx.fillStyle='yellow'; // Tô màu vàng
    ctx.fill();
}

// --- Update Functions ---
function updateTank() {
    if (gameOver || levelComplete) return; // Không cho di chuyển khi game over hoặc hoàn thành level

    // Di chuyển
    if (tank.isMovingLeft && tank.x > 0) {
        tank.x -= tank.speed;
    }
    if (tank.isMovingRight && tank.x < canvasWidth - tank.width) {
        tank.x += tank.speed;
    }

    // Xoay nòng
    const minAngle = -Math.PI / 2 + 0.1;
    const maxAngle = Math.PI / 6;
    if (tank.isTurretMovingUp && tank.turret.angle > minAngle) {
        tank.turret.angle -= tank.turret.angleSpeed;
    }
    if (tank.isTurretMovingDown && tank.turret.angle < maxAngle) {
        tank.turret.angle += tank.turret.angleSpeed;
    }
    tank.turret.angle = Math.max(minAngle, Math.min(maxAngle, tank.turret.angle));
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // Cập nhật vận tốc Y theo trọng lực
        bullet.vy += gravity;
        // Cập nhật vận tốc X theo gió
        bullet.vx += wind;

        // Cập nhật vị trí
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Kiểm tra va chạm với mục tiêu
        if (!target.isHit &&
            bullet.x > target.x && bullet.x < target.x + target.width &&
            bullet.y > target.y - target.height && bullet.y < target.y)
        {
            target.isHit = true;
            bullets.splice(i, 1); // Xóa viên đạn
            levelComplete = true;
            setMessage("Trúng mục tiêu!", true);
            // Chuyển level sau 1.5 giây
            setTimeout(nextLevel, 1500);
            continue; // Không cần kiểm tra va chạm khác cho viên đạn này
        }

        // Kiểm tra va chạm với chướng ngại vật
        let hitObstacle = false;
        for(const obstacle of obstacles) {
            if (bullet.x > obstacle.x && bullet.x < obstacle.x + obstacle.width &&
                bullet.y > obstacle.y - obstacle.height && bullet.y < obstacle.y)
            {
                bullets.splice(i, 1); // Xóa viên đạn
                hitObstacle = true;
                // Có thể thêm hiệu ứng nổ nhỏ ở đây
                break; // Đạn chỉ va chạm 1 vật cản 1 lần
            }
        }
        if (hitObstacle) continue;


        // Kiểm tra va chạm với mặt đất (đáy canvas)
        if (bullet.y > canvasHeight) {
            bullets.splice(i, 1); // Xóa viên đạn
             // Có thể thêm hiệu ứng nổ nhỏ ở đây
            continue;
        }

        // Xóa đạn nếu bay ra khỏi màn hình (trái, phải, trên)
        if (bullet.x < -bullet.radius || bullet.x > canvasWidth + bullet.radius || bullet.y < -bullet.radius) {
            bullets.splice(i, 1);
        }
    }
}

// --- Game Logic ---
function fireBullet() {
    if (!tank.canFire || gameOver || levelComplete) return;

    // Tính vị trí đầu nòng súng
    const turretPivotX = tank.x + tank.turret.pivotXOffset;
    const turretPivotY = tank.y - tank.height + tank.turret.pivotYOffset;
    const muzzleX = turretPivotX + Math.cos(tank.turret.angle) * tank.turret.length;
    const muzzleY = turretPivotY + Math.sin(tank.turret.angle) * tank.turret.length;

    // Tính vận tốc ban đầu theo thành phần x, y
    const angle = tank.turret.angle;
    const vx = Math.cos(angle) * initialBulletVelocity;
    const vy = Math.sin(angle) * initialBulletVelocity;

    // Tạo viên đạn mới
    bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: vx,
        vy: vy,
        radius: 4 // Bán kính viên đạn
    });

    // Bắt đầu cooldown
    tank.canFire = false;
    setTimeout(() => {
        tank.canFire = true;
    }, tank.fireCooldown);
}

function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) {
        setMessage("CHIẾN THẮNG HOÀN TOÀN!", true);
        gameOver = true;
        return;
    }

    const levelData = levels[levelIndex];
    currentLevel = levelIndex;
    levelDisplay.textContent = currentLevel + 1;
    setMessage(""); // Xóa thông báo cũ

    // Đặt mục tiêu dựa trên tỷ lệ màn hình
    target.width = levelData.target.width;
    target.height = levelData.target.height;
    target.x = canvasWidth * levelData.target.xRatio - target.width / 2; // Căn giữa mục tiêu theo xRatio
    target.y = canvasHeight * levelData.target.yRatio + target.height; // Đặt đáy mục tiêu theo yRatio
    target.isHit = false;


    // Đặt chướng ngại vật
    obstacles = levelData.obstacles.map(obsData => ({
        width: obsData.width,
        height: obsData.height,
        x: canvasWidth * obsData.xRatio - obsData.width / 2,
        y: canvasHeight * obsData.yRatio + obsData.height,
        color: obsData.color
    }));

    // Đặt gió
    wind = levelData.wind || 0;

    // Reset trạng thái
    bullets = []; // Xóa đạn cũ
    tank.x = 50; // Reset vị trí xe tăng
    tank.turret.angle = -Math.PI / 6; // Reset góc nòng
    gameOver = false;
    levelComplete = false;
    tank.canFire = true; // Luôn cho phép bắn khi bắt đầu level
}

function nextLevel() {
    loadLevel(currentLevel + 1);
}

function setMessage(msg, isSuccess = false) {
    messageDisplay.textContent = msg;
    messageDisplay.className = isSuccess ? 'target-hit-message' : '';
}

// --- Main Game Loop ---
function gameLoop() {
    // 1. Xóa màn hình
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Cập nhật trạng thái
    updateTank();
    updateBullets();

    // 3. Vẽ lại mọi thứ
    drawObstacles(); // Vẽ vật cản trước mục tiêu
    drawTarget();
    drawTank();
    drawBullets();

    // Vẽ chỉ báo gió (nếu có)
    if (wind !== 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const windText = `Gió: ${wind > 0 ? '>' : '<'} ${Math.abs(wind * 100).toFixed(0)}`;
        ctx.fillText(windText, canvasWidth / 2, 20);
    }


    // 4. Lặp lại
    if (!gameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// --- Event Listeners ---
// (Giữ nguyên các listener cho nút di chuyển và xoay nòng từ code trước)
// ... (copy các listener mousedown/mouseup/touchstart/touchend cho btnLeft, btnRight, btnTurretUp, btnTurretDown) ...

// Listener cho nút bắn
btnFire.addEventListener('click', fireBullet); // Click chuột
btnFire.addEventListener('touchstart', (e) => { // Chạm màn hình
     e.preventDefault(); // Ngăn hành vi mặc định (zoom, scroll...)
     fireBullet();
}, { passive: false });


// --- Initialization ---
function resizeCanvas() {
    const container = document.getElementById('game-container');
    // Lấy kích thước chính xác của container sau khi CSS được áp dụng
    const style = window.getComputedStyle(container);
    const width = parseInt(style.width);
    const height = parseInt(style.height);

    canvas.width = width;
    canvas.height = height;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    // Cập nhật lại vị trí Y của xe tăng
    tank.y = canvasHeight;

    // Tải lại level hiện tại để cập nhật vị trí mục tiêu/vật cản theo kích thước mới
    // Chỉ tải lại nếu game chưa kết thúc
    if (!gameOver) {
         // Lưu lại trạng thái isHit tạm thời nếu đang trong thông báo hoàn thành level
        const tempIsHit = target.isHit;
        const tempLevelComplete = levelComplete;

        loadLevel(currentLevel); // Tải lại cấu hình level

        // Khôi phục trạng thái nếu đang chuyển level
        target.isHit = tempIsHit;
        levelComplete = tempLevelComplete;
        if(levelComplete) {
             setMessage("Trúng mục tiêu!", true); // Hiển thị lại thông báo nếu cần
        }
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Gọi lần đầu
loadLevel(currentLevel); // Tải level đầu tiên
gameLoop(); // Bắt đầu game
