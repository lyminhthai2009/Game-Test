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
const windIndicator = document.getElementById('wind-indicator'); // Lấy lại element này

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = [];
let windAcceleration = 0; // Đổi tên để rõ là gia tốc
let gameOver = false;
let gameState = 'LEVEL_START';
let lastShooterId = 'enemy';
let switchTurnTimeout = null; // KHAI BÁO Ở ĐÂY

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
    // Thân xe
    ctx.fillStyle = tankObj.color;
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);
    // Bánh xích giả
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height * 0.4, tankObj.width, tankObj.height * 0.4);
    ctx.fillStyle = '#495057';
    const treadWidth = tankObj.width / 6;
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(tankObj.x + i * treadWidth, tankObj.y - tankObj.height * 0.4, treadWidth * 0.8, tankObj.height * 0.4);
    }

    // Nòng súng
    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset !== undefined ? tankObj.turret.pivotXOffset : tankObj.width / 2);
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset !== undefined ? tankObj.turret.pivotYOffset : 0) - 3;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tankObj.turret.angle);
    ctx.fillStyle = tankObj.turret.color;
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
    const healthBarHeight = 6;
    const healthBarX = tankObj.x;
    const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 5;
    const currentHealthWidth = Math.max(0, (tankObj.health / tankObj.maxHealth) * healthBarWidth);
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > (tankObj.maxHealth * 0.3) ? '#28a745' : '#dc3545';
    ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
    ctx.strokeStyle = '#adb5bd';
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.fillStyle = bullet.owner === 'player' ? '#000000' : '#8B0000';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}


// --- Update Functions ---
function updatePlayerTank() {
    if (gameState !== 'PLAYER_TURN' || gameOver) {
        tank.isMovingLeft = false; tank.isMovingRight = false; return;
    }
    if (tank.isMovingLeft) {
        const nextX = tank.x - tank.speed;
        if (nextX >= 0) { tank.x = nextX; }
    }
    if (tank.isMovingRight) {
        const nextX = tank.x + tank.speed;
        if (nextX <= canvasWidth - tank.width) { tank.x = nextX; }
    }
}

function updateEnemyTank() {
    if (enemyTank.isMoving) {
        const moveDirection = Math.sign(enemyTank.moveTargetX - enemyTank.x);
        enemyTank.x += moveDirection * ENEMY_MOVE_SPEED;

        if (Math.abs(enemyTank.x - enemyTank.moveTargetX) < ENEMY_MOVE_SPEED) {
            enemyTank.x = enemyTank.moveTargetX;
            enemyTank.isMoving = false;
            if (gameState === 'ENEMY_TURN_MOVE') { // Chuyển sang trạng thái ngắm bắn sau khi dừng
                 gameState = 'ENEMY_TURN';
                 enemyAI();
            }
        }
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
        // Vật lý nâng cao
        const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
        const dragForceMagnitude = AIR_DRAG_COEFFICIENT * speed * speed;
        const accel_drag_x = (speed > 0.1 ? (bullet.vx / speed) * dragForceMagnitude : 0);
        const accel_drag_y = (speed > 0.1 ? (bullet.vy / speed) * dragForceMagnitude : 0);
        const ax_total = windAcceleration - accel_drag_x;
        const ay_total = GRAVITY_ACCELERATION - accel_drag_y;
        bullet.vx += ax_total;
        bullet.vy += ay_total;
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Va chạm
        let hitTargetTank = null;
        let damage = 0;
        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) {
            hitTargetTank = enemyTank;
            damage = Math.floor(Math.random() * 11) + 20;
        } else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) {
            hitTargetTank = tank;
            damage = enemyTank.baseDamage + Math.floor(Math.random() * (enemyTank.damageRange + 1));
        }

        if (hitTargetTank) {
            bullets.splice(i, 1); dealDamage(hitTargetTank, damage); continue;
        }
        if (bullet.y + bullet.radius > canvasHeight) {
            bullets.splice(i, 1); continue;
        }
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) {
            bullets.splice(i, 1);
        }
    }
    if (bullets.length === 0) { switchTurn(); }
}


function checkCollision(bullet, targetTank) {
    const bulletLeft = bullet.x - bullet.radius;
    const bulletRight = bullet.x + bullet.radius;
    const bulletTop = bullet.y - bullet.radius;
    const bulletBottom = bullet.y + bullet.radius;
    const tankLeft = targetTank.x;
    const tankRight = targetTank.x + targetTank.width;
    const tankTop = targetTank.y - targetTank.height;
    const tankBottom = targetTank.y;
    return bulletRight > tankLeft && bulletLeft < tankRight && bulletBottom > tankTop && bulletTop < tankBottom;
}

function dealDamage(targetTank, amount) {
    targetTank.health -= amount;
    setMessage(`${targetTank.id === 'player' ? 'Bạn' : 'Địch'} trúng đạn! (-${amount} HP)`, false);
    if (targetTank.health <= 0) { targetTank.health = 0; }
    updateUI();
}

// --- AI Logic ---
function simulateShot(startX, startY, angleRad, velocity, targetTank) {
    let simX = startX; let simY = startY;
    let simVx = Math.cos(angleRad) * velocity;
    let simVy = Math.sin(angleRad) * velocity;
    let steps = 0;
    while (simY <= canvasHeight + 100 && steps < MAX_SIMULATION_STEPS) {
        const speed = Math.sqrt(simVx * simVx + simVy * simVy);
        const dragForceMagnitude = AIR_DRAG_COEFFICIENT * speed * speed;
        const accel_drag_x = (speed > 0.1 ? (simVx / speed) * dragForceMagnitude : 0);
        const accel_drag_y = (speed > 0.1 ? (simVy / speed) * dragForceMagnitude : 0);
        const ax_total = windAcceleration - accel_drag_x;
        const ay_total = GRAVITY_ACCELERATION - accel_drag_y;
        simVx += ax_total; simVy += ay_total;
        simX += simVx; simY += simVy;

        const simBullet = { x: simX, y: simY, radius: 3 };
        if (checkCollision(simBullet, targetTank)) {
            return { hit: true, x: simX, y: simY, steps: steps };
        }
        steps++;
    }
    return { hit: false, x: simX, y: simY, steps: steps };
}


function enemyAI() {
    // AI giờ được gọi sau khi địch dừng di chuyển (trong updateEnemyTank hoặc switchTurn nếu không di chuyển)
    if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return;
    setMessage("Địch đang tính toán...");
    updateUI();

    setTimeout(() => {
        if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return;

        const sourceX = enemyTank.x + enemyTank.width / 2;
        const sourceY = enemyTank.y - enemyTank.height / 2;
        const targetX = tank.x + tank.width / 2;
        const targetY = tank.y - tank.height / 2;

        let bestShot = { angle: -Math.PI / 2, power: 10, closestDistSq: Infinity, hit: false };
        const angleStep = Math.PI / 180 * 1.2;
        const powerStep = 1.2;
        const minPower = 9;
        const maxPower = 26;

        for (let power = minPower; power <= maxPower; power += powerStep) {
            for (let angle = -Math.PI * 0.95; angle < -Math.PI * 0.05; angle += angleStep) {
                const simResult = simulateShot(sourceX, sourceY, angle, power, tank);
                if (simResult.hit) {
                    bestShot = { angle: angle, power: power, closestDistSq: 0, hit: true }; break;
                } else {
                    const dx = simResult.x - targetX;
                    const distSq = dx * dx * 1.5 + (simResult.y - targetY) * (simResult.y - targetY);
                    if (distSq < bestShot.closestDistSq) { bestShot = { angle: angle, power: power, closestDistSq: distSq, hit: false }; }
                }
            }
            if (bestShot.hit) break;
        }

        let finalAngle = bestShot.angle;
        let finalPower = bestShot.power;
        const errorMagnitude = enemyTank.aimAccuracyError * (Math.PI / 4); // Giảm scale sai số 1 chút
        finalAngle += (Math.random() - 0.5) * 2 * errorMagnitude;
        finalPower += (Math.random() - 0.5) * (maxPower * 0.1 * enemyTank.aimAccuracyError);

        const minEnemyAngle = -Math.PI * 0.95; const maxEnemyAngle = -Math.PI * 0.05;
        enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, finalAngle));

        setMessage("Địch bắn!");
        fireBullet(enemyTank, Math.max(minPower, finalPower));

    }, 50);
}

// --- Game Logic ---
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
        setMessage("");
        fireBullet(tank, velocity);
    }
}

function startEnemyMovement() {
    if (gameOver || enemyTank.isMoving) return; // Không di chuyển nếu đang di chuyển hoặc game over
    let moveDirection = (Math.random() < 0.5) ? -1 : 1;
    let targetX = enemyTank.x + moveDirection * (ENEMY_MOVE_RANGE * 0.7 + Math.random() * ENEMY_MOVE_RANGE * 0.6); // Di chuyển xa hơn chút
    targetX = Math.max(enemyTank.width * 0.5, Math.min(canvasWidth - enemyTank.width * 1.5, targetX));
    if (Math.abs(targetX - enemyTank.x) < 20) { // Đảm bảo di chuyển đủ xa
         targetX = enemyTank.x - moveDirection * (ENEMY_MOVE_RANGE * 0.5 + Math.random() * ENEMY_MOVE_RANGE * 0.5);
         targetX = Math.max(enemyTank.width * 0.5, Math.min(canvasWidth - enemyTank.width * 1.5, targetX));
    }
    enemyTank.moveTargetX = targetX;
    enemyTank.isMoving = true;
    // Trạng thái sẽ được đổi thành ENEMY_TURN khi dừng trong updateEnemyTank
}

function switchTurn() {
    if (switchTurnTimeout) return;
    // Chỉ chuyển lượt khi đạn đã dừng bay và không có viên nào đang bay
    if (gameState !== 'BULLET_FLYING' || bullets.length > 0) return;

    switchTurnTimeout = setTimeout(() => {
        switchTurnTimeout = null;
        if (gameOver) return;

        if (enemyTank.health <= 0) { handleGameOver(true); return; }
        if (tank.health <= 0) { handleGameOver(false); return; }

        if (lastShooterId === 'player') {
            // Quyết định xem địch có di chuyển không (ví dụ: 70% cơ hội di chuyển)
            if (Math.random() < 0.7) {
                gameState = 'ENEMY_TURN_MOVE';
                setMessage("Địch di chuyển...");
                updateUI();
                startEnemyMovement();
            } else {
                // Nếu không di chuyển, chuyển thẳng sang lượt bắn của địch
                gameState = 'ENEMY_TURN';
                setMessage("Lượt của Địch");
                updateUI();
                enemyAI(); // Gọi AI để ngắm bắn ngay
            }
        } else { // Lượt trước là của địch
            gameState = 'PLAYER_TURN';
            tank.canFire = true;
            setMessage("Lượt của Bạn");
            updatePhysicsDataDisplay(); // Cập nhật dữ liệu cho player
            updateUI();
        }
    }, turnSwitchDelay);
}

function handleGameOver(playerWins) {
    if (gameOver) return;
    gameOver = true; gameState = 'GAME_OVER';
    setMessage(playerWins ? "CHIẾN THẮNG!" : "THẤT BẠI!", playerWins);
    updateUI();
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }
    const delay = playerWins ? 2500 : 3000;
    setTimeout(() => {
        if (playerWins) {
            if (currentLevel < levels.length - 1) { nextLevel(); }
            else { setMessage("Bạn đã hoàn thành tất cả các màn!", true); }
        } else { loadLevel(currentLevel); }
    }, delay);
}

function loadLevel(levelIndex) {
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }
    if (levelIndex >= levels.length) { /* ... hết level ... */ return; }

    const levelData = levels[levelIndex];
    currentLevel = levelIndex; gameOver = false; gameState = 'LEVEL_START';

    // Reset Player
    tank.health = tank.maxHealth; tank.x = 50; tank.y = canvasHeight;
    angleInput.value = 45; velocityInput.value = 15;
    tank.turret.angle = -(45 * Math.PI / 180);
    angleVisual.textContent = `(45°)`; velocityVisual.textContent = `(15.0)`;
    tank.canFire = true; tank.isMovingLeft = false; tank.isMovingRight = false;

    // Setup Enemy
    enemyTank.maxHealth = Math.floor(100 * levelData.enemyHealthMultiplier);
    enemyTank.health = enemyTank.maxHealth;
    enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
    enemyTank.y = canvasHeight;
    enemyTank.aimAccuracyError = levelData.aimError;
    enemyTank.isMoving = false; // Reset trạng thái di chuyển
    enemyTank.turret.angle = Math.atan2(tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2), tank.x + tank.width/2 - (enemyTank.x + enemyTank.width/2));
    if (enemyTank.turret.angle > -Math.PI * 0.1) enemyTank.turret.angle = -Math.PI * 0.1;
    if (enemyTank.turret.angle < -Math.PI * 0.9) enemyTank.turret.angle = -Math.PI * 0.9;

    // Gió
    windAcceleration = levelData.wind || 0;

    // Reset khác
    bullets = [];
    setMessage(`Level ${currentLevel + 1} bắt đầu!`);
    updateUI();

    // Bắt đầu lượt chơi
    setTimeout(() => {
        if (!gameOver && gameState === 'LEVEL_START') {
             gameState = 'PLAYER_TURN'; lastShooterId = 'enemy';
             setMessage("Lượt của Bạn");
             updatePhysicsDataDisplay(); // Hiển thị data ban đầu
             updateUI();
        }
    }, 1500);
}


function nextLevel() { loadLevel(currentLevel + 1); }

// --- UI Update Functions ---
function updatePhysicsDataDisplay() {
    const physicsDataDiv = document.getElementById('physics-data');
    if (gameOver || gameState !== 'PLAYER_TURN') {
        physicsDataDiv.style.opacity = '0.5'; return;
    }
    physicsDataDiv.style.opacity = '1';

    const pivotX = tank.x + tank.turret.pivotXOffset;
    const pivotY = tank.y - tank.height + tank.turret.pivotYOffset - 3;
    const angle = tank.turret.angle;
    const muzzleX = pivotX + Math.cos(angle) * tank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * tank.turret.length;
    const targetX = enemyTank.x + enemyTank.width / 2;
    const targetY = enemyTank.y - enemyTank.height / 2;

    muzzlePosDisplay.textContent = `(${muzzleX.toFixed(1)}, ${muzzleY.toFixed(1)})`;
    targetPosDisplay.textContent = `(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`;
    gravityValDisplay.textContent = GRAVITY_ACCELERATION.toFixed(3);
    windValDisplay.textContent = windAcceleration.toFixed(4);
    dragValDisplay.textContent = AIR_DRAG_COEFFICIENT.toFixed(5);
}


function updateUI() {
    levelDisplay.textContent = currentLevel + 1;
    playerHealthDisplay.textContent = `Player: ${tank.health}/${tank.maxHealth}`;
    enemyHealthDisplay.textContent = `Enemy: ${enemyTank.health}/${enemyTank.maxHealth}`;

    let turnText = ""; let turnColor = "#333";
    switch (gameState) {
        case 'PLAYER_TURN': turnText = "Lượt của Bạn"; turnColor = tank.color; break;
        case 'ENEMY_TURN_MOVE': turnText = "Địch di chuyển..."; turnColor = enemyTank.color; break; // Thêm state di chuyển
        case 'ENEMY_TURN': turnText = "Lượt của Địch"; turnColor = enemyTank.color; break;
        case 'BULLET_FLYING': turnText = "Đạn đang bay..."; turnColor = '#555'; break;
        case 'GAME_OVER': turnText = "Game Over"; turnColor = '#000'; break;
        case 'LEVEL_START': turnText = "Chuẩn bị..."; turnColor = '#555'; break;
    }
    turnDisplay.textContent = turnText;
    turnDisplay.style.color = turnColor;

    if (windAcceleration !== 0 && !gameOver) {
        windIndicator.textContent = `Gió: ${windAcceleration > 0 ? '>>' : '<<'} ${Math.abs(windAcceleration * 100).toFixed(0)}`;
    } else { windIndicator.textContent = ""; }

    const currentAngleVal = parseFloat(angleInput.value).toFixed(0);
    const currentVelVal = parseFloat(velocityInput.value).toFixed(1);
    if (angleVisual.textContent !== `(${currentAngleVal}°)`) angleVisual.textContent = `(${currentAngleVal}°)`;
    if (velocityVisual.textContent !== `(${currentVelVal})`) velocityVisual.textContent = `(${currentVelVal})`;
}

function setMessage(msg, isSuccess = false) {
    messageDisplay.textContent = msg;
    let msgColor = '#333';
    if (gameState === 'GAME_OVER') { msgColor = isSuccess ? 'green' : 'red'; }
    else if (msg.includes("Địch")) { msgColor = enemyTank.color; }
    else if (msg.includes("Bạn")) { msgColor = tank.color; }
    else if (msg.includes("trúng đạn")) { msgColor = '#e65c00'; }
    messageDisplay.style.color = msgColor;
}

// --- Main Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!gameOver) {
         updatePlayerTank();
         updateEnemyTank(); // Cập nhật di chuyển địch
         updateBullets();
    }
    drawTankObject(tank);
    drawTankObject(enemyTank);
    drawBullets();
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    const handleMoveStart = (key) => { if (gameState === 'PLAYER_TURN' && !gameOver) tank[key] = true; };
    const handleMoveEnd = (key) => { tank[key] = false; };

    btnLeft.addEventListener('mousedown', () => handleMoveStart('isMovingLeft'));
    btnLeft.addEventListener('mouseup', () => handleMoveEnd('isMovingLeft'));
    btnLeft.addEventListener('mouseleave', () => handleMoveEnd('isMovingLeft'));
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isMovingLeft'); }, { passive: false });
    btnLeft.addEventListener('touchend', () => handleMoveEnd('isMovingLeft'));

    btnRight.addEventListener('mousedown', () => handleMoveStart('isMovingRight'));
    btnRight.addEventListener('mouseup', () => handleMoveEnd('isMovingRight'));
    btnRight.addEventListener('mouseleave', () => handleMoveEnd('isMovingRight'));
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isMovingRight'); }, { passive: false });
    btnRight.addEventListener('touchend', () => handleMoveEnd('isMovingRight'));

    angleInput.addEventListener('input', () => {
        const angleDeg = parseFloat(angleInput.value);
        if (!isNaN(angleDeg) && angleDeg >= 0 && angleDeg <= 90) {
             const angleRad = -(angleDeg * Math.PI / 180);
             tank.turret.angle = angleRad;
             angleVisual.textContent = `(${angleDeg.toFixed(0)}°)`;
        } else { angleVisual.textContent = `(??°)`; }
    });

    velocityInput.addEventListener('input', () => {
         const velocity = parseFloat(velocityInput.value);
        if (!isNaN(velocity) && velocity >= 1 && velocity <= 25) {
            velocityVisual.textContent = `(${velocity.toFixed(1)})`;
        } else { velocityVisual.textContent = `(??)`; }
    });

    btnFire.addEventListener('click', handleFireInput);
    btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); handleFireInput(); }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
}


// --- Initialization ---
function resizeCanvas() {
    // --- Lưu trạng thái hiện tại ---
    const currentTankHealth = tank.health;
    const currentEnemyHealth = enemyTank.health;
    const currentGameState = gameState;
    const currentGameOver = gameOver; // <<--- ĐÃ SỬA LỖI Ở ĐÂY
    const currentLastShooter = lastShooterId;
    const currentBullets = bullets.map(b => ({ ...b }));
    const currentAngle = angleInput.value;
    const currentVelocity = velocityInput.value;
    const currentTankAngle = tank.turret.angle;
    const currentEnemyIsMoving = enemyTank.isMoving; // Lưu trạng thái di chuyển địch
    const currentEnemyMoveTarget = enemyTank.moveTargetX;
    //------------------------------------

    // Resize canvas
    const container = document.getElementById('game-container');
    const style = window.getComputedStyle(container);
    const width = parseInt(style.width);
    const height = parseInt(style.height);
    canvas.width = width; canvas.height = height;
    canvasWidth = canvas.width; canvasHeight = canvas.height;

    // Cập nhật Y tanks
    tank.y = canvasHeight; enemyTank.y = canvasHeight;

    // Khôi phục hoặc tải lại level
    if (!currentGameOver && currentGameState !== 'LEVEL_START') {
        const levelData = levels[currentLevel];
        enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
        enemyTank.x = Math.max(0, Math.min(canvasWidth - enemyTank.width, enemyTank.x)); // Đảm bảo trong màn hình

        // Khôi phục trạng thái game
        tank.health = currentTankHealth;
        enemyTank.health = currentEnemyHealth;
        gameState = currentGameState;
        gameOver = currentGameOver;
        lastShooterId = currentLastShooter;
        bullets = currentBullets;
        angleInput.value = currentAngle;
        velocityInput.value = currentVelocity;
        tank.turret.angle = currentTankAngle;
        enemyTank.isMoving = currentEnemyIsMoving; // Khôi phục trạng thái di chuyển
        enemyTank.moveTargetX = currentEnemyMoveTarget; // Khôi phục đích di chuyển

        angleVisual.textContent = `(${parseFloat(currentAngle).toFixed(0)}°)`;
        velocityVisual.textContent = `(${parseFloat(currentVelocity).toFixed(1)})`;

        bullets.forEach(b => { if (b.y > canvasHeight) b.y = canvasHeight - b.radius; });

        if (currentGameState === 'PLAYER_TURN') {
           updatePhysicsDataDisplay();
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
