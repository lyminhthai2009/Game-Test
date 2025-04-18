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
const physicsDataDiv = document.getElementById('physics-data');
const muzzlePosDisplay = document.getElementById('muzzle-pos');
const targetPosDisplay = document.getElementById('target-pos');
const gravityValDisplay = document.getElementById('gravity-val');
const windValDisplay = document.getElementById('wind-val');
const windIndicator = document.getElementById('wind-indicator'); // <<<--- Đảm bảo ID này khớp với HTML

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = [];
let windAcceleration = 0;
let gameOver = false;
let gameState = 'LEVEL_START';
let lastShooterId = 'enemy';
let switchTurnTimeout = null;

// --- Game Constants ---
const GRAVITY_ACCELERATION = 0.18;
const AIR_DRAG_COEFFICIENT = 0; // Đã bỏ lực cản
const ENEMY_MOVE_SPEED = 1.5;
const ENEMY_MOVE_RANGE = 80;
const enemyFireDelay = 1600;
const turnSwitchDelay = 900;
const playerFireCooldown = 500;
const MAX_SIMULATION_STEPS = 350;

// --- Player Tank Definition ---
const tank = {
    id: 'player', x: 50, y: 0, width: 50, height: 25,
    color: '#28a745', speed: 2.5,
    turret: { length: 35, width: 8, angle: -(45 * Math.PI / 180), color: '#218838', pivotXOffset: 25, pivotYOffset: 0 },
    health: 100, maxHealth: 100, isMovingLeft: false, isMovingRight: false, canFire: true,
};

// --- Enemy Tank Definition ---
const enemyTank = {
    id: 'enemy', x: 0, y: 0, width: 50, height: 25, color: '#dc3545',
    turret: { length: 35, width: 8, angle: -3 * Math.PI / 4, color: '#c82333', },
    health: 100, maxHealth: 100, aimAccuracyError: 0.1, baseDamage: 28, damageRange: 17,
    isMoving: false, moveTargetX: 0,
};

// --- Level Definitions ---
const levels = [
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.0, wind: 0,      aimError: 0.18 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 1.1, wind: 0.01,   aimError: 0.12 },
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 1.3, wind: -0.015, aimError: 0.08 },
    { enemyXRatio: 0.7,  enemyHealthMultiplier: 1.5, wind: 0.025,  aimError: 0.06 },
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.8, wind: -0.035, aimError: 0.04 },
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 2.3, wind: 0.045,  aimError: 0.025 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 3.0, wind: -0.055, aimError: 0.015 },
];

// --- Drawing Functions ---
function drawTankObject(tankObj) {
    ctx.fillStyle = tankObj.color; ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);
    ctx.fillStyle = '#6c757d'; ctx.fillRect(tankObj.x, tankObj.y - tankObj.height * 0.4, tankObj.width, tankObj.height * 0.4);
    ctx.fillStyle = '#495057'; const treadWidth = tankObj.width / 6;
    for (let i = 0; i < 6; i++) { ctx.fillRect(tankObj.x + i * treadWidth, tankObj.y - tankObj.height * 0.4, treadWidth * 0.8, tankObj.height * 0.4); }
    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset ?? tankObj.width / 2);
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset ?? 0) - 3;
    ctx.translate(pivotX, pivotY); ctx.rotate(tankObj.turret.angle); ctx.fillStyle = tankObj.turret.color;
    ctx.beginPath(); ctx.moveTo(0, -tankObj.turret.width * 0.7); ctx.lineTo(tankObj.turret.length * 0.6, -tankObj.turret.width * 0.5); ctx.lineTo(tankObj.turret.length, -tankObj.turret.width * 0.4); ctx.lineTo(tankObj.turret.length, tankObj.turret.width * 0.4); ctx.lineTo(tankObj.turret.length * 0.6, tankObj.turret.width * 0.5); ctx.lineTo(0, tankObj.turret.width * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();
    const healthBarWidth = tankObj.width; const healthBarHeight = 6; const healthBarX = tankObj.x; const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 5;
    const currentHealthWidth = Math.max(0, (tankObj.health / tankObj.maxHealth) * healthBarWidth);
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > (tankObj.maxHealth * 0.3) ? '#28a745' : '#dc3545'; ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
    ctx.strokeStyle = '#adb5bd'; ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
}

function drawBullets() { bullets.forEach(bullet => { ctx.fillStyle = bullet.owner === 'player' ? '#000000' : '#8B0000'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); ctx.fill(); }); }

// --- Update Functions ---
function updatePlayerTank() { if (gameState !== 'PLAYER_TURN' || gameOver) { tank.isMovingLeft = false; tank.isMovingRight = false; return; } if (tank.isMovingLeft) { const nextX = tank.x - tank.speed; if (nextX >= 0) { tank.x = nextX; } } if (tank.isMovingRight) { const nextX = tank.x + tank.speed; if (nextX <= canvasWidth - tank.width) { tank.x = nextX; } } }

function updateEnemyTank() { if (enemyTank.isMoving) { const moveDirection = Math.sign(enemyTank.moveTargetX - enemyTank.x); enemyTank.x += moveDirection * ENEMY_MOVE_SPEED; if (Math.abs(enemyTank.x - enemyTank.moveTargetX) < ENEMY_MOVE_SPEED) { enemyTank.x = enemyTank.moveTargetX; enemyTank.isMoving = false; if (gameState === 'ENEMY_TURN_MOVE') { gameState = 'ENEMY_TURN'; enemyAI(); } } enemyTank.x = Math.max(0, Math.min(canvasWidth - enemyTank.width, enemyTank.x)); } }

function updateBullets() {
    if (bullets.length === 0) { if (gameState === 'BULLET_FLYING') { switchTurn(); } return; }
    if (gameState !== 'BULLET_FLYING') return;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const ax_total = windAcceleration; const ay_total = GRAVITY_ACCELERATION;
        bullet.vx += ax_total; bullet.vy += ay_total; bullet.x += bullet.vx; bullet.y += bullet.vy;
        let hitTargetTank = null; let damage = 0;
        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) { hitTargetTank = enemyTank; damage = Math.floor(Math.random() * 11) + 20; }
        else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) { hitTargetTank = tank; damage = enemyTank.baseDamage + Math.floor(Math.random() * (enemyTank.damageRange + 1)); }
        if (hitTargetTank) { bullets.splice(i, 1); dealDamage(hitTargetTank, damage); continue; }
        if (bullet.y + bullet.radius > canvasHeight) { bullets.splice(i, 1); continue; }
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) { bullets.splice(i, 1); }
    }
    if (bullets.length === 0) { switchTurn(); }
}

function checkCollision(bullet, targetTank) { const bulletLeft = bullet.x - bullet.radius; const bulletRight = bullet.x + bullet.radius; const bulletTop = bullet.y - bullet.radius; const bulletBottom = bullet.y + bullet.radius; const tankLeft = targetTank.x; const tankRight = targetTank.x + targetTank.width; const tankTop = targetTank.y - targetTank.height; const tankBottom = targetTank.y; return bulletRight > tankLeft && bulletLeft < tankRight && bulletBottom > tankTop && bulletTop < tankBottom; }
function dealDamage(targetTank, amount) { targetTank.health -= amount; setMessage(`${targetTank.id === 'player' ? 'Bạn' : 'Địch'} trúng đạn! (-${amount} HP)`, false); if (targetTank.health <= 0) { targetTank.health = 0; } updateUI(); }

// --- AI Logic ---
function simulateShot(startX, startY, angleRad, velocity, targetTank) {
    let simX = startX; let simY = startY; let simVx = Math.cos(angleRad) * velocity; let simVy = Math.sin(angleRad) * velocity; let steps = 0;
    while (simY <= canvasHeight + 100 && steps < MAX_SIMULATION_STEPS) {
        const ax_total = windAcceleration; const ay_total = GRAVITY_ACCELERATION; simVx += ax_total; simVy += ay_total; simX += simVx; simY += simVy;
        const simBullet = { x: simX, y: simY, radius: 3 }; if (checkCollision(simBullet, targetTank)) { return { hit: true, x: simX, y: simY, steps: steps }; } steps++;
    } return { hit: false, x: simX, y: simY, steps: steps };
}

function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return; setMessage("Địch đang tính toán..."); updateUI();
    setTimeout(() => {
        if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return;
        const sourceX = enemyTank.x + enemyTank.width / 2; const sourceY = enemyTank.y - enemyTank.height / 2; const targetX = tank.x + tank.width / 2; const targetY = tank.y - tank.height / 2;
        let bestShot = { angle: -Math.PI / 2, power: 10, closestDistSq: Infinity, hit: false };
        const angleStep = Math.PI / 180 * 1.2; const powerStep = 1.2; const minPower = 9; const maxPower = 26;
        for (let power = minPower; power <= maxPower; power += powerStep) {
            for (let angle = -Math.PI * 0.95; angle < -Math.PI * 0.05; angle += angleStep) {
                const simResult = simulateShot(sourceX, sourceY, angle, power, tank);
                if (simResult.hit) { bestShot = { angle: angle, power: power, closestDistSq: 0, hit: true }; break; }
                else { const dx = simResult.x - targetX; const distSq = dx * dx * 1.5 + (simResult.y - targetY) * (simResult.y - targetY); if (distSq < bestShot.closestDistSq) { bestShot = { angle: angle, power: power, closestDistSq: distSq, hit: false }; } }
            } if (bestShot.hit) break;
        }
        let finalAngle = bestShot.angle; let finalPower = bestShot.power; const errorMagnitude = enemyTank.aimAccuracyError * (Math.PI / 4); finalAngle += (Math.random() - 0.5) * 2 * errorMagnitude; finalPower += (Math.random() - 0.5) * (maxPower * 0.1 * enemyTank.aimAccuracyError);
        const minEnemyAngle = -Math.PI * 0.95; const maxEnemyAngle = -Math.PI * 0.05; enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, finalAngle));
        setMessage("Địch bắn!"); fireBullet(enemyTank, Math.max(minPower, finalPower));
    }, 50);
}

// --- Game Logic ---
function fireBullet(shooterTank, power) { const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset ?? shooterTank.width / 2); const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset ?? 0) - 3; const angle = shooterTank.turret.angle; const muzzleX = pivotX + Math.cos(angle) * shooterTank.turret.length; const muzzleY = pivotY + Math.sin(angle) * shooterTank.turret.length; const vx = Math.cos(angle) * power; const vy = Math.sin(angle) * power; bullets.push({ owner: shooterTank.id, x: muzzleX, y: muzzleY, vx: vx, vy: vy, radius: 4 }); lastShooterId = shooterTank.id; gameState = 'BULLET_FLYING'; updateUI(); if (shooterTank.id === 'player') { tank.canFire = false; setTimeout(() => { if (gameState === 'PLAYER_TURN' || gameState === 'LEVEL_START') { tank.canFire = true; } }, playerFireCooldown); } }
function handleFireInput() { if (gameState === 'PLAYER_TURN' && tank.canFire && !gameOver) { const angleDeg = parseFloat(angleInput.value); const velocity = parseFloat(velocityInput.value); if (isNaN(angleDeg) || angleDeg < 0 || angleDeg > 90 || isNaN(velocity) || velocity < 1 || velocity > 25) { setMessage("Giá trị Góc/Lực không hợp lệ!", false); return; } setMessage(""); fireBullet(tank, velocity); } }
function startEnemyMovement() { if (gameOver || enemyTank.isMoving) return; let moveDirection = (Math.random() < 0.5) ? -1 : 1; let targetX = enemyTank.x + moveDirection * (ENEMY_MOVE_RANGE * 0.7 + Math.random() * ENEMY_MOVE_RANGE * 0.6); targetX = Math.max(enemyTank.width * 0.5, Math.min(canvasWidth - enemyTank.width * 1.5, targetX)); if (Math.abs(targetX - enemyTank.x) < 20) { targetX = enemyTank.x - moveDirection * (ENEMY_MOVE_RANGE * 0.5 + Math.random() * ENEMY_MOVE_RANGE * 0.5); targetX = Math.max(enemyTank.width * 0.5, Math.min(canvasWidth - enemyTank.width * 1.5, targetX)); } enemyTank.moveTargetX = targetX; enemyTank.isMoving = true; }

function switchTurn() {
    if (switchTurnTimeout) return;
    if (gameState !== 'BULLET_FLYING' || bullets.length > 0) return;
    switchTurnTimeout = setTimeout(() => {
        switchTurnTimeout = null; if (gameOver) return;
        if (enemyTank.health <= 0) { handleGameOver(true); return; }
        if (tank.health <= 0) { handleGameOver(false); return; }
        if (lastShooterId === 'player') {
            if (Math.random() < 0.7) { gameState = 'ENEMY_TURN_MOVE'; setMessage("Địch di chuyển..."); updateUI(); startEnemyMovement(); }
            else { gameState = 'ENEMY_TURN'; setMessage("Lượt của Địch"); updateUI(); enemyAI(); }
        } else { gameState = 'PLAYER_TURN'; tank.canFire = true; setMessage("Lượt của Bạn"); updatePhysicsDataDisplay(); updateUI(); }
    }, turnSwitchDelay);
}

function handleGameOver(playerWins) { if (gameOver) return; gameOver = true; gameState = 'GAME_OVER'; setMessage(playerWins ? "CHIẾN THẮNG!" : "THẤT BẠI!", playerWins); updateUI(); if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; } const delay = playerWins ? 2500 : 3000; setTimeout(() => { if (playerWins) { if (currentLevel < levels.length - 1) { nextLevel(); } else { setMessage("Bạn đã hoàn thành tất cả các màn!", true); } } else { loadLevel(currentLevel); } }, delay); }

function loadLevel(levelIndex) {
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }
    if (levelIndex >= levels.length) { setMessage("Bạn đã hoàn thành tất cả các màn!", true); gameOver = true; gameState = 'GAME_OVER'; updateUI(); return; }
    const levelData = levels[levelIndex]; currentLevel = levelIndex; gameOver = false; gameState = 'LEVEL_START';
    tank.health = tank.maxHealth; tank.x = 50; tank.y = canvasHeight; angleInput.value = 45; velocityInput.value = 15; tank.turret.angle = -(45 * Math.PI / 180); angleVisual.textContent = `(45°)`; velocityVisual.textContent = `(15.0)`; tank.canFire = true; tank.isMovingLeft = false; tank.isMovingRight = false;
    enemyTank.maxHealth = Math.floor(100 * levelData.enemyHealthMultiplier); enemyTank.health = enemyTank.maxHealth; enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2; enemyTank.y = canvasHeight; enemyTank.aimAccuracyError = levelData.aimError; enemyTank.isMoving = false;
    enemyTank.turret.angle = Math.atan2(tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2), tank.x + tank.width/2 - (enemyTank.x + enemyTank.width/2)); if (enemyTank.turret.angle > -Math.PI * 0.1) enemyTank.turret.angle = -Math.PI * 0.1; if (enemyTank.turret.angle < -Math.PI * 0.9) enemyTank.turret.angle = -Math.PI * 0.9;
    windAcceleration = levelData.wind || 0;
    bullets = []; setMessage(`Level ${currentLevel + 1} bắt đầu!`); updateUI();
    setTimeout(() => { if (!gameOver && gameState === 'LEVEL_START') { gameState = 'PLAYER_TURN'; lastShooterId = 'enemy'; setMessage("Lượt của Bạn"); updatePhysicsDataDisplay(); updateUI(); } }, 1500);
}

function nextLevel() { loadLevel(currentLevel + 1); }

// --- UI Update Functions ---
function updatePhysicsDataDisplay() {
    if (gameOver || gameState !== 'PLAYER_TURN') { physicsDataDiv.setAttribute('data-inactive', 'true'); return; }
    physicsDataDiv.removeAttribute('data-inactive');
    const pivotX = tank.x + tank.turret.pivotXOffset; const pivotY = tank.y - tank.height + tank.turret.pivotYOffset - 3;
    const angle = tank.turret.angle; const muzzleX = pivotX + Math.cos(angle) * tank.turret.length; const muzzleY = pivotY + Math.sin(angle) * tank.turret.length;
    const targetX = enemyTank.x + enemyTank.width / 2; const targetY = enemyTank.y - enemyTank.height / 2;
    muzzlePosDisplay.textContent = `(${muzzleX.toFixed(1)}, ${muzzleY.toFixed(1)})`; targetPosDisplay.textContent = `(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`;
    gravityValDisplay.textContent = GRAVITY_ACCELERATION.toFixed(3); windValDisplay.textContent = windAcceleration.toFixed(4);
    // dragValDisplay không còn tồn tại
}

function updateUI() {
    levelDisplay.textContent = currentLevel + 1;
    playerHealthDisplay.textContent = `Player: ${tank.health}/${tank.maxHealth}`;
    enemyHealthDisplay.textContent = `Enemy: ${enemyTank.health}/${enemyTank.maxHealth}`;
    let turnText = ""; let turnColor = "#333";
    switch (gameState) {
        case 'PLAYER_TURN': turnText = "Lượt của Bạn"; turnColor = tank.color; break;
        case 'ENEMY_TURN_MOVE': turnText = "Địch di chuyển..."; turnColor = enemyTank.color; break;
        case 'ENEMY_TURN': turnText = "Lượt của Địch"; turnColor = enemyTank.color; break;
        case 'BULLET_FLYING': turnText = "Đạn đang bay..."; turnColor = '#555'; break;
        case 'GAME_OVER': turnText = "Game Over"; turnColor = '#000'; break;
        case 'LEVEL_START': turnText = "Chuẩn bị..."; turnColor = '#555'; break;
    }
    turnDisplay.textContent = turnText; turnDisplay.style.color = turnColor;

    // Chỉ cập nhật windIndicator nếu element tồn tại
    if (windIndicator) {
        if (windAcceleration !== 0 && !gameOver) {
            windIndicator.textContent = `Gió: ${windAcceleration > 0 ? '>>' : '<<'} ${Math.abs(windAcceleration * 100).toFixed(0)}`;
        } else { windIndicator.textContent = ""; }
    }


    const currentAngleVal = parseFloat(angleInput.value).toFixed(0); const currentVelVal = parseFloat(velocityInput.value).toFixed(1);
    if (angleVisual && angleVisual.textContent !== `(${currentAngleVal}°)`) angleVisual.textContent = `(${currentAngleVal}°)`; // Kiểm tra null
    if (velocityVisual && velocityVisual.textContent !== `(${currentVelVal})`) velocityVisual.textContent = `(${currentVelVal})`; // Kiểm tra null

    updatePhysicsDataDisplay();
}

function setMessage(msg, isSuccess = false) {
    // Kiểm tra messageDisplay tồn tại trước khi set
    if (messageDisplay) {
        messageDisplay.textContent = msg; let msgColor = '#333';
        if (gameState === 'GAME_OVER') { msgColor = isSuccess ? 'green' : 'red'; }
        else if (msg.includes("Địch")) { msgColor = enemyTank.color; }
        else if (msg.includes("Bạn")) { msgColor = tank.color; }
        else if (msg.includes("trúng đạn")) { msgColor = '#e65c00'; }
        messageDisplay.style.color = msgColor;
    }
}

// --- Main Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!gameOver) { updatePlayerTank(); updateEnemyTank(); updateBullets(); }
    drawTankObject(tank); drawTankObject(enemyTank); drawBullets();
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    const handleMoveStart = (key) => { if (gameState === 'PLAYER_TURN' && !gameOver) tank[key] = true; };
    const handleMoveEnd = (key) => { tank[key] = false; };
    btnLeft.addEventListener('mousedown', () => handleMoveStart('isMovingLeft')); btnLeft.addEventListener('mouseup', () => handleMoveEnd('isMovingLeft')); btnLeft.addEventListener('mouseleave', () => handleMoveEnd('isMovingLeft')); btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isMovingLeft'); }, { passive: false }); btnLeft.addEventListener('touchend', () => handleMoveEnd('isMovingLeft'));
    btnRight.addEventListener('mousedown', () => handleMoveStart('isMovingRight')); btnRight.addEventListener('mouseup', () => handleMoveEnd('isMovingRight')); btnRight.addEventListener('mouseleave', () => handleMoveEnd('isMovingRight')); btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isMovingRight'); }, { passive: false }); btnRight.addEventListener('touchend', () => handleMoveEnd('isMovingRight'));
    angleInput.addEventListener('input', () => { const angleDeg = parseFloat(angleInput.value); if (!isNaN(angleDeg) && angleDeg >= 0 && angleDeg <= 90) { const angleRad = -(angleDeg * Math.PI / 180); tank.turret.angle = angleRad; if (angleVisual) angleVisual.textContent = `(${angleDeg.toFixed(0)}°)`; } else { if (angleVisual) angleVisual.textContent = `(??°)`; } });
    velocityInput.addEventListener('input', () => { const velocity = parseFloat(velocityInput.value); if (!isNaN(velocity) && velocity >= 1 && velocity <= 25) { if (velocityVisual) velocityVisual.textContent = `(${velocity.toFixed(1)})`; } else { if (velocityVisual) velocityVisual.textContent = `(??)`; } });
    btnFire.addEventListener('click', handleFireInput); btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); handleFireInput(); }, { passive: false });
    window.addEventListener('resize', resizeCanvas);
}

// --- Initialization ---
function resizeCanvas() {
    const currentTankHealth = tank.health; const currentEnemyHealth = enemyTank.health;
    const currentGameState = gameState; const currentGameOver = gameOver; // <<<--- Đảm bảo sử dụng biến này
    const currentLastShooter = lastShooterId; const currentBullets = bullets.map(b => ({ ...b }));
    const currentAngle = angleInput.value; const currentVelocity = velocityInput.value;
    const currentTankAngle = tank.turret.angle; const currentEnemyIsMoving = enemyTank.isMoving;
    const currentEnemyMoveTarget = enemyTank.moveTargetX;

    const container = document.getElementById('game-container'); const style = window.getComputedStyle(container);
    const width = parseInt(style.width); const height = parseInt(style.height);
    canvas.width = width; canvas.height = height; canvasWidth = canvas.width; canvasHeight = canvas.height;
    tank.y = canvasHeight; enemyTank.y = canvasHeight;

    // Sử dụng currentGameOver đã lưu
    if (!currentGameOver && currentGameState !== 'LEVEL_START') {
        const levelData = levels[currentLevel];
        enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
        enemyTank.x = Math.max(0, Math.min(canvasWidth - enemyTank.width, enemyTank.x));
        tank.health = currentTankHealth; enemyTank.health = currentEnemyHealth; gameState = currentGameState; gameOver = currentGameOver; // Khôi phục gameOver
        lastShooterId = currentLastShooter; bullets = currentBullets; angleInput.value = currentAngle; velocityInput.value = currentVelocity;
        tank.turret.angle = currentTankAngle; enemyTank.isMoving = currentEnemyIsMoving; enemyTank.moveTargetX = currentEnemyMoveTarget;
        if(angleVisual) angleVisual.textContent = `(${parseFloat(currentAngle).toFixed(0)}°)`; // Kiểm tra null
        if(velocityVisual) velocityVisual.textContent = `(${parseFloat(currentVelocity).toFixed(1)})`; // Kiểm tra null
        bullets.forEach(b => { if (b.y > canvasHeight) b.y = canvasHeight - b.radius; });
        updateUI();
    } else { loadLevel(currentLevel); }
}

// --- Start the game ---
// Thêm kiểm tra null cho các element trước khi bắt đầu game loop
if (!canvas || !ctx || !btnLeft || !btnRight || !angleInput || !velocityInput || !angleVisual || !velocityVisual || !btnFire || !levelDisplay || !playerHealthDisplay || !enemyHealthDisplay || !turnDisplay || !messageDisplay || !physicsDataDiv || !muzzlePosDisplay || !targetPosDisplay || !gravityValDisplay || !windValDisplay || !windIndicator) {
    console.error("LỖI KHỞI TẠO: Một hoặc nhiều phần tử HTML không được tìm thấy. Kiểm tra lại ID trong HTML và JS.");
    // Có thể hiển thị thông báo lỗi cho người dùng ở đây
} else {
    setupEventListeners();
    resizeCanvas();      // Chạy lần đầu để lấy kích thước và load level 0
    gameLoop();          // Bắt đầu vòng lặp nếu không có lỗi
}
