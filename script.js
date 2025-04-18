// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const angleInput = document.getElementById('angle-input');
const velocityInput = document.getElementById('velocity-input');
const angleVisual = document.getElementById('angle-visual');
const velocityVisual = document.getElementById('velocity-visual');
const btnFire = document.getElementById('btn-fire');
const levelDisplay = document.getElementById('level-display');
const playerHealthDisplay = document.getElementById('player-health');
const enemyHealthDisplay = document.getElementById('enemy-health');
const turnDisplay = document.getElementById('turn-indicator');
const messageDisplay = document.getElementById('message-display');
// Physics Data Display Elements
const muzzlePosDisplay = document.getElementById('muzzle-pos');
const targetPosDisplay = document.getElementById('target-pos');
const gravityValDisplay = document.getElementById('gravity-val');
const windValDisplay = document.getElementById('wind-val');
const dragValDisplay = document.getElementById('drag-val'); // Hiển thị hệ số cản

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = [];
let windAcceleration = 0; // Đổi tên để rõ là gia tốc
let gameOver = false;
let gameState = 'LEVEL_START';
let lastShooterId = 'enemy';
let switchTurnTimeout = null;

// --- Game Constants ---
const GRAVITY_ACCELERATION = 0.18; // Gia tốc trọng trường (pixel/frame^2), tăng nhẹ
const AIR_DRAG_COEFFICIENT = 0.0015; // Hệ số lực cản không khí (k) - Tinh chỉnh giá trị này!
const ENEMY_MOVE_SPEED = 1.5;      // Tốc độ di chuyển của địch
const ENEMY_MOVE_RANGE = 80;       // Khoảng cách di chuyển tối đa của địch (pixels)
const enemyFireDelay = 1600;       // Tăng delay AI
const turnSwitchDelay = 900;       // Tăng delay chuyển lượt
const playerFireCooldown = 500;
const MAX_SIMULATION_STEPS = 350; // Tăng giới hạn mô phỏng

// --- Player Tank Definition ---
const tank = {
    id: 'player',
    x: 50, y: 0, width: 50, height: 25,
    color: '#28a745', // Xanh lá cây đậm hơn
    speed: 2.5,
    turret: {
        length: 35, width: 8, angle: -(45 * Math.PI / 180),
        color: '#218838', pivotXOffset: 25, pivotYOffset: 0
    },
    health: 100, maxHealth: 100,
    isMovingLeft: false, isMovingRight: false,
    canFire: true,
};

// --- Enemy Tank Definition ---
const enemyTank = {
    id: 'enemy',
    x: 0, y: 0, width: 50, height: 25,
    color: '#dc3545', // Màu đỏ đậm hơn
    turret: {
        length: 35, width: 8, angle: -3 * Math.PI / 4,
        color: '#c82333',
    },
    health: 100, maxHealth: 100,
    aimAccuracyError: 0.1,
    baseDamage: 28, // Tăng damage địch
    damageRange: 17, // (28-45)
    isMoving: false, // Cờ trạng thái di chuyển
    moveTargetX: 0,  // Vị trí đích khi di chuyển
};

// --- Level Definitions ---
const levels = [ // Điều chỉnh lại độ khó với AI mới và lực cản
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.0, wind: 0,      aimError: 0.18 }, // Dễ hơn chút ban đầu
    { enemyXRatio: 0.75, enemyHealthMultiplier: 1.1, wind: 0.01,   aimError: 0.12 },
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 1.3, wind: -0.015, aimError: 0.08 },
    { enemyXRatio: 0.7,  enemyHealthMultiplier: 1.5, wind: 0.025,  aimError: 0.06 },
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.8, wind: -0.035, aimError: 0.04 },
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 2.3, wind: 0.045,  aimError: 0.025 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 3.0, wind: -0.055, aimError: 0.015 },// Khó hơn nữa
];

// --- Drawing Functions ---
function drawTankObject(tankObj) {
    // Thân xe (thêm chi tiết giả)
    ctx.fillStyle = tankObj.color;
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);
    // Bánh xích giả
    ctx.fillStyle = '#6c757d'; // Màu xám đậm
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height * 0.4, tankObj.width, tankObj.height * 0.4);
    ctx.fillStyle = '#495057'; // Màu xám tối hơn
    const treadWidth = tankObj.width / 6;
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(tankObj.x + i * treadWidth, tankObj.y - tankObj.height * 0.4, treadWidth * 0.8, tankObj.height * 0.4);
    }

    // Nòng súng
    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset !== undefined ? tankObj.turret.pivotXOffset : tankObj.width / 2);
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset !== undefined ? tankObj.turret.pivotYOffset : 0) - 3; // Nâng nòng lên chút
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tankObj.turret.angle);
    ctx.fillStyle = tankObj.turret.color;
    // Vẽ nòng dày hơn ở gốc
    ctx.beginPath();
    ctx.moveTo(0, -tankObj.turret.width * 0.7);
    ctx.lineTo(tankObj.turret.length * 0.6, -tankObj.turret.width * 0.5);
    ctx.lineTo(tankObj.turret.length, -tankObj.turret.width * 0.4);
    ctx.lineTo(tankObj.turret.length, tankObj.turret.width * 0.4);
    ctx.lineTo(tankObj.turret.length * 0.6, tankObj.turret.width * 0.5);
    ctx.lineTo(0, tankObj.turret.width * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Thanh máu
    const healthBarWidth = tankObj.width;
    const healthBarHeight = 6; // Dày hơn
    const healthBarX = tankObj.x;
    const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 5; // Cách xa hơn
    const currentHealthWidth = Math.max(0, (tankObj.health / tankObj.maxHealth) * healthBarWidth);
    ctx.fillStyle = '#e9ecef'; // Nền thanh máu sáng hơn
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > (tankObj.maxHealth * 0.3) ? '#28a745' : '#dc3545'; // Màu máu đồng bộ tank
    ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
    ctx.strokeStyle = '#adb5bd'; // Viền thanh máu
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
}

function drawBullets() { /* Giữ nguyên */ }

// --- Update Functions ---
function updatePlayerTank() { /* Giữ nguyên logic di chuyển */ }

function updateEnemyTank() {
    // Xử lý di chuyển của Enemy nếu đang di chuyển
    if (enemyTank.isMoving) {
        const moveDirection = Math.sign(enemyTank.moveTargetX - enemyTank.x);
        enemyTank.x += moveDirection * ENEMY_MOVE_SPEED;

        // Kiểm tra nếu đã đến đích hoặc vượt qua
        if (Math.abs(enemyTank.x - enemyTank.moveTargetX) < ENEMY_MOVE_SPEED) {
            enemyTank.x = enemyTank.moveTargetX; // Snap to target
            enemyTank.isMoving = false;
            // console.log("Enemy stopped moving.");
            // Sau khi dừng di chuyển, mới gọi AI để ngắm bắn
            if (gameState === 'ENEMY_TURN') {
                 enemyAI();
            }
        }
        // Giữ trong màn hình
        enemyTank.x = Math.max(0, Math.min(canvasWidth - enemyTank.width, enemyTank.x));
    }
}


function updateBullets() {
    if (bullets.length === 0) {
        if (gameState === 'BULLET_FLYING') { switchTurn(); }
        return;
    }
    if (gameState !== 'BULLET_FLYING') return;

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // --- Tính toán vật lý nâng cao ---
        const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);

        // Lực cản không khí (tỷ lệ với v^2, ngược hướng vận tốc)
        // F_drag = -k * v^2 => a_drag = -k/m * v^2 . Giả sử m=1, a_drag = -k * v^2
        // Chia thành các thành phần:
        const dragForceMagnitude = AIR_DRAG_COEFFICIENT * speed * speed;
        const accel_drag_x = (bullet.vx / speed) * dragForceMagnitude; // a_drag * (vx/v)
        const accel_drag_y = (bullet.vy / speed) * dragForceMagnitude; // a_drag * (vy/v)

        // Gia tốc tổng cộng (gia tốc = lực/khối lượng, giả sử khối lượng đạn = 1)
        // ax_total = ax_wind - ax_drag
        // ay_total = ay_gravity - ay_drag
        const ax_total = windAcceleration - (speed > 0.1 ? accel_drag_x : 0); // Tránh chia cho 0 nếu vận tốc gần = 0
        const ay_total = GRAVITY_ACCELERATION - (speed > 0.1 ? accel_drag_y : 0);

        // Cập nhật vận tốc (v = v0 + a*t, giả sử t=1 frame)
        bullet.vx += ax_total;
        bullet.vy += ay_total;

        // Cập nhật vị trí (x = x0 + v*t, giả sử t=1 frame)
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        // --- Kết thúc tính toán vật lý ---


        let hitTargetTank = null;
        let damage = 0;

        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) {
            hitTargetTank = enemyTank;
            damage = Math.floor(Math.random() * 11) + 20;
        } else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) {
            hitTargetTank = tank;
            damage = enemyTank.baseDamage + Math.floor(Math.random() * (enemyTank.damageRange + 1));
        }

        if (hitTargetTank) { /* ... xử lý va chạm ... */ }
        if (bullet.y + bullet.radius > canvasHeight) { /* ... xử lý chạm đất ... */ }
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) { /* ... xử lý ra ngoài ... */ }
    }
    if (bullets.length === 0) { switchTurn(); }
}


function checkCollision(bullet, targetTank) { /* Giữ nguyên */ }
function dealDamage(targetTank, amount) { /* Giữ nguyên */ }

// --- AI Logic ---
function simulateShot(startX, startY, angleRad, velocity, targetTank) {
    let simX = startX; let simY = startY;
    let simVx = Math.cos(angleRad) * velocity;
    let simVy = Math.sin(angleRad) * velocity;
    let steps = 0;

    while (simY <= canvasHeight + 100 && steps < MAX_SIMULATION_STEPS) { // Tăng giới hạn Y xuống
        // --- Áp dụng vật lý giống hệt updateBullets ---
        const speed = Math.sqrt(simVx * simVx + simVy * simVy);
        const dragForceMagnitude = AIR_DRAG_COEFFICIENT * speed * speed;
        const accel_drag_x = (speed > 0.1 ? (simVx / speed) * dragForceMagnitude : 0);
        const accel_drag_y = (speed > 0.1 ? (simVy / speed) * dragForceMagnitude : 0);
        const ax_total = windAcceleration - accel_drag_x;
        const ay_total = GRAVITY_ACCELERATION - accel_drag_y;
        simVx += ax_total;
        simVy += ay_total;
        simX += simVx;
        simY += simVy;
        // --- Hết vật lý mô phỏng ---

        const simBullet = { x: simX, y: simY, radius: 3 }; // Tăng nhẹ radius check
        if (checkCollision(simBullet, targetTank)) {
            return { hit: true, x: simX, y: simY, steps: steps };
        }
        steps++;
    }
    return { hit: false, x: simX, y: simY, steps: steps };
}


function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return; // Không bắn nếu đang di chuyển
    setMessage("Địch đang tính toán...");
    updateUI();

    setTimeout(() => {
        if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return;

        const sourceX = enemyTank.x + enemyTank.width / 2;
        const sourceY = enemyTank.y - enemyTank.height / 2;
        const targetX = tank.x + tank.width / 2;
        const targetY = tank.y - tank.height / 2;

        let bestShot = { angle: -Math.PI / 2, power: 10, closestDistSq: Infinity, hit: false };

        const angleStep = Math.PI / 180 * 1.2; // Bước góc tinh chỉnh
        const powerStep = 1.2;
        const minPower = 9; // Tăng lực bắn tối thiểu
        const maxPower = 26; // Tăng lực bắn tối đa

        for (let power = minPower; power <= maxPower; power += powerStep) {
            for (let angle = -Math.PI * 0.95; angle < -Math.PI * 0.05; angle += angleStep) {
                const simResult = simulateShot(sourceX, sourceY, angle, power, tank);
                if (simResult.hit) {
                    bestShot = { angle: angle, power: power, closestDistSq: 0, hit: true };
                    break;
                } else {
                    const dx = simResult.x - targetX;
                    const distSq = dx * dx * 1.5 + (simResult.y - targetY) * (simResult.y - targetY); // Ưu tiên gần ngang
                    if (distSq < bestShot.closestDistSq) {
                         bestShot = { angle: angle, power: power, closestDistSq: distSq, hit: false };
                    }
                }
            }
            if (bestShot.hit) break;
        }

        let finalAngle = bestShot.angle;
        let finalPower = bestShot.power;

        const errorMagnitude = enemyTank.aimAccuracyError * (Math.PI / 4); // Scale sai số
        finalAngle += (Math.random() - 0.5) * 2 * errorMagnitude;
        // Thêm sai số nhỏ cho lực bắn dựa trên độ lỗi
        finalPower += (Math.random() - 0.5) * (maxPower * 0.1 * enemyTank.aimAccuracyError); // Sai số lực tỉ lệ với aimError

        const minEnemyAngle = -Math.PI * 0.95; const maxEnemyAngle = -Math.PI * 0.05;
        enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, finalAngle));

        setMessage("Địch bắn!");
        fireBullet(enemyTank, Math.max(minPower, finalPower)); // Đảm bảo lực bắn không quá thấp

    }, 50);
}

// --- Game Logic ---
function fireBullet(shooterTank, power) { /* ... (Giữ nguyên logic tạo đạn, nhưng dùng GRAVITY_ACCELERATION) ... */ }

function handleFireInput() { /* ... (Giữ nguyên logic đọc input và gọi fireBullet) ... */ }


// --- Enemy Movement Logic ---
function startEnemyMovement() {
    if (gameOver) return;
    // Quyết định hướng di chuyển (ngẫu nhiên hoặc dựa trên vị trí player)
    let moveDirection = (Math.random() < 0.5) ? -1 : 1;
    // Hoặc: let moveDirection = Math.sign(tank.x - enemyTank.x); // Di chuyển về phía player? Coi chừng bị kẹt góc

    // Tính vị trí đích mới
    let targetX = enemyTank.x + moveDirection * (Math.random() * ENEMY_MOVE_RANGE);

    // Giới hạn trong màn hình
    targetX = Math.max(enemyTank.width / 2, Math.min(canvasWidth - enemyTank.width * 1.5, targetX)); // Tránh ra rìa quá

    // Đảm bảo di chuyển một khoảng cách tối thiểu
    if (Math.abs(targetX - enemyTank.x) < 10) {
         // Nếu khoảng cách quá nhỏ, thử di chuyển xa hơn theo hướng ngược lại
         targetX = enemyTank.x - moveDirection * (ENEMY_MOVE_RANGE * 0.5 + Math.random() * ENEMY_MOVE_RANGE * 0.5);
         targetX = Math.max(enemyTank.width / 2, Math.min(canvasWidth - enemyTank.width * 1.5, targetX));
    }


    // console.log(`Enemy moving from ${enemyTank.x.toFixed(0)} to ${targetX.toFixed(0)}`);
    enemyTank.moveTargetX = targetX;
    enemyTank.isMoving = true;
}


function switchTurn() {
    if (switchTurnTimeout) return;
    if (gameState !== 'BULLET_FLYING' || bullets.length > 0) return;

    switchTurnTimeout = setTimeout(() => {
        switchTurnTimeout = null;
        if (gameOver) return;

        if (enemyTank.health <= 0) { handleGameOver(true); return; }
        if (tank.health <= 0) { handleGameOver(false); return; }

        if (lastShooterId === 'player') {
            gameState = 'ENEMY_TURN_MOVE'; // Trạng thái mới: Địch chuẩn bị di chuyển
            setMessage("Địch di chuyển...");
            updateUI();
            startEnemyMovement(); // Bắt đầu di chuyển địch
            // AI sẽ được gọi trong updateEnemyTank khi địch dừng
        } else { // Lượt trước là của địch
            gameState = 'PLAYER_TURN';
            tank.canFire = true;
            setMessage("Lượt của Bạn");
            updatePhysicsDataDisplay(); // *** CẬP NHẬT DỮ LIỆU CHO PLAYER ***
            updateUI();
        }
    }, turnSwitchDelay);
}

function handleGameOver(playerWins) { /* ... Giữ nguyên ... */ }

function loadLevel(levelIndex) {
    /* ... (Giữ nguyên logic reset cơ bản) ... */

    // Setup Enemy
    /* ... (reset máu, vị trí X, Y) ... */
    enemyTank.aimAccuracyError = levelData.aimError;
    enemyTank.isMoving = false; // Đảm bảo địch không di chuyển khi load level
    /* ... (ngắm sơ bộ) ... */

    // Đặt gió (lưu dưới dạng gia tốc)
    windAcceleration = levelData.wind || 0;

    /* ... (reset đạn, message, UI) ... */

    // Bắt đầu lượt chơi
    setTimeout(() => {
        if (!gameOver && gameState === 'LEVEL_START') {
             gameState = 'PLAYER_TURN';
             lastShooterId = 'enemy';
             setMessage("Lượt của Bạn");
             updatePhysicsDataDisplay(); // Hiển thị dữ liệu ban đầu
             updateUI();
        }
    }, 1500);
}


function nextLevel() { /* ... Giữ nguyên ... */ }

// --- UI Update Functions ---
function updatePhysicsDataDisplay() {
    if (gameOver || gameState !== 'PLAYER_TURN') {
        // Có thể ẩn hoặc làm mờ khu vực dữ liệu khi không phải lượt player
        document.getElementById('physics-data').style.opacity = '0.5';
        return;
    }
     document.getElementById('physics-data').style.opacity = '1';

    // Tính vị trí nòng súng của player
    const pivotX = tank.x + tank.turret.pivotXOffset;
    const pivotY = tank.y - tank.height + tank.turret.pivotYOffset - 3; // Giống lúc vẽ
    const angle = tank.turret.angle;
    const muzzleX = pivotX + Math.cos(angle) * tank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * tank.turret.length;

    // Vị trí mục tiêu (tâm xe địch)
    const targetX = enemyTank.x + enemyTank.width / 2;
    const targetY = enemyTank.y - enemyTank.height / 2;

    // Hiển thị dữ liệu
    muzzlePosDisplay.textContent = `(${muzzleX.toFixed(1)}, ${muzzleY.toFixed(1)})`;
    targetPosDisplay.textContent = `(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`;
    gravityValDisplay.textContent = GRAVITY_ACCELERATION.toFixed(3);
    windValDisplay.textContent = windAcceleration.toFixed(4); // Hiển thị nhiều chữ số hơn cho gió/cản
    dragValDisplay.textContent = AIR_DRAG_COEFFICIENT.toFixed(5);
}


function updateUI() {
    /* ... (Cập nhật level, máu, lượt chơi) ... */

    // Cập nhật chỉ báo gió (dùng windAcceleration)
    if (windAcceleration !== 0 && !gameOver) {
        windIndicator.textContent = `Gió: ${windAcceleration > 0 ? '>>' : '<<'} ${Math.abs(windAcceleration * 100).toFixed(0)}`; // Scale để dễ đọc
    } else { windIndicator.textContent = ""; }

    /* ... (Cập nhật hiển thị input angle/velocity) ... */
}

function setMessage(msg, isSuccess = false) { /* ... Giữ nguyên ... */ }

// --- Main Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!gameOver) {
         updatePlayerTank();
         updateEnemyTank(); // *** THÊM CẬP NHẬT DI CHUYỂN ĐỊCH ***
         updateBullets();
    }
    // Vẽ lại
    drawTankObject(tank);
    drawTankObject(enemyTank);
    drawBullets();
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners Setup ---
function setupEventListeners() { /* ... Giữ nguyên ... */ }

// --- Initialization ---
function resizeCanvas() { /* ... (Cần đảm bảo khôi phục state và gọi updatePhysicsDataDisplay nếu đang là lượt player) ... */
    // ... (lưu state cũ) ...
    // ... (resize canvas, cập nhật width/height) ...
    // ... (cập nhật Y tank) ...

     if (!currentGameOver && currentGameState !== 'LEVEL_START') {
         // ... (cập nhật X địch) ...
         // ... (khôi phục state máu, game, đạn, input...) ...
         if(currentGameState === 'PLAYER_TURN'){
            updatePhysicsDataDisplay(); // Cập nhật lại data vật lý sau resize
         }
         updateUI();
     } else {
        loadLevel(currentLevel);
     }

}

// --- Start the game ---
setupEventListeners();
resizeCanvas();
gameLoop();

//*************************************************
// Các hàm cần copy/kiểm tra lại từ phiên bản trước
// (Đã tích hợp các thay đổi cần thiết ở trên):
// - fireBullet(shooterTank, power)
// - handleFireInput()
// - handleGameOver(playerWins)
// - nextLevel()
//*************************************************
function fireBullet(shooterTank, power) {
    const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset !== undefined ? shooterTank.turret.pivotXOffset : shooterTank.width / 2);
    const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset !== undefined ? shooterTank.turret.pivotYOffset : 0) - 3;
    const angle = shooterTank.turret.angle;
    const muzzleX = pivotX + Math.cos(angle) * shooterTank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * shooterTank.turret.length;
    const vx = Math.cos(angle) * power;
    const vy = Math.sin(angle) * power;

    bullets.push({ owner: shooterTank.id, x: muzzleX, y: muzzleY, vx: vx, vy: vy, radius: 4 });

    lastShooterId = shooterTank.id;
    gameState = 'BULLET_FLYING';
    updateUI();

    if (shooterTank.id === 'player') {
        tank.canFire = false;
        setTimeout(() => {
            if (gameState === 'PLAYER_TURN' || gameState === 'LEVEL_START') { tank.canFire = true; }
        }, playerFireCooldown);
    }
}

function handleFireInput() {
    if (gameState === 'PLAYER_TURN' && tank.canFire && !gameOver) {
        const angleDeg = parseFloat(angleInput.value);
        const velocity = parseFloat(velocityInput.value);
        if (isNaN(angleDeg) || angleDeg < 0 || angleDeg > 90 || isNaN(velocity) || velocity < 1 || velocity > 25) {
            setMessage("Giá trị Góc/Lực không hợp lệ!", false); return;
        }
        // Góc nòng đã được cập nhật qua 'input' event
        setMessage("");
        fireBullet(tank, velocity);
    }
}
