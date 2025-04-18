// --- DOM Elements ---
// ... (Giữ nguyên các element đã lấy) ...

// --- Game State ---
// ... (Giữ nguyên các biến state) ...
let terrainHeights = []; // <<<--- MẢNG LƯU ĐỘ CAO ĐỊA HÌNH

// --- Game Constants ---
const GRAVITY_ACCELERATION = 0.18;
const AIR_DRAG_COEFFICIENT = 0; // Vẫn giữ = 0 (không có lực cản)
const ENEMY_MOVE_SPEED = 1.5;
const ENEMY_MOVE_RANGE = 80;
const enemyFireDelay = 1700; // Tăng nhẹ nữa
const turnSwitchDelay = 900;
const playerFireCooldown = 500;
const MAX_SIMULATION_STEPS = 400; // Tăng giới hạn cho quỹ đạo phức tạp hơn
const TERRAIN_RESOLUTION = 5;     // <<<--- Độ chi tiết địa hình (vẽ 1 điểm mỗi 5 pixel ngang)
const TERRAIN_BASE_HEIGHT_RATIO = 0.8; // <<<--- Độ cao nền địa hình (tỷ lệ so với chiều cao canvas)
const TERRAIN_VARIATION = 80;      // <<<--- Biên độ dao động độ cao địa hình (pixels)
const TERRAIN_SMOOTHNESS = 0.03;   // <<<--- Độ "mượt" của địa hình (tần số thấp hơn = mượt hơn)

// --- Player & Enemy Tank Definitions ---
// ... (Giữ nguyên) ...

// --- Level Definitions ---
// ... (Giữ nguyên) ...

// --- Terrain Generation ---
function generateTerrain() {
    terrainHeights = [];
    const baseHeight = canvasHeight * TERRAIN_BASE_HEIGHT_RATIO;
    let currentHeight = baseHeight;
    // Dùng Perlin noise hoặc hàm sin đơn giản để tạo địa hình tự nhiên hơn
    // Ví dụ dùng hàm sin kết hợp random:
    const randFactor1 = Math.random() * 5 + 2; // Tần số ngẫu nhiên
    const randFactor2 = Math.random() * 10 + 5;
    const randPhase1 = Math.random() * Math.PI * 2;
    const randPhase2 = Math.random() * Math.PI * 2;

    for (let x = 0; x < canvasWidth; x += TERRAIN_RESOLUTION) {
        // Kết hợp nhiều sóng sin + nhiễu nhẹ
        let heightOffset = Math.sin(x * TERRAIN_SMOOTHNESS * 0.5 + randPhase1) * TERRAIN_VARIATION * 0.6;
        heightOffset += Math.sin(x * TERRAIN_SMOOTHNESS * 1.5 + randPhase2) * TERRAIN_VARIATION * 0.4;
        heightOffset += (Math.random() - 0.5) * TERRAIN_VARIATION * 0.1; // Nhiễu nhỏ

        currentHeight = baseHeight + heightOffset;
        // Đảm bảo độ cao không quá thấp hoặc quá cao
        currentHeight = Math.max(canvasHeight * 0.3, Math.min(canvasHeight * 0.95, currentHeight));

        // Lưu độ cao cho từng đoạn resolution
        for (let i = 0; i < TERRAIN_RESOLUTION && x + i < canvasWidth; i++) {
            // Nội suy tuyến tính đơn giản giữa điểm cuối và điểm mới (hoặc giữ nguyên)
            terrainHeights[x + i] = Math.floor(currentHeight); // Lưu giá trị nguyên cho dễ xử lý
        }
    }
     // Đảm bảo phần tử cuối cùng được điền
     if (terrainHeights.length < canvasWidth) {
        const lastH = terrainHeights[terrainHeights.length - 1];
        for(let i = terrainHeights.length; i < canvasWidth; i++) {
             terrainHeights[i] = lastH;
        }
     }
    console.log("Terrain generated, length:", terrainHeights.length); // Debug
}

// Hàm lấy độ cao địa hình tại điểm x (có kiểm tra biên)
function getTerrainHeight(x) {
    const index = Math.max(0, Math.min(canvasWidth - 1, Math.floor(x))); // Clamp index
    return terrainHeights[index] || canvasHeight; // Trả về đáy nếu index sai
}


// --- Drawing Functions ---
function drawTerrain() {
    ctx.fillStyle = '#78c480'; // Màu cỏ chính
    ctx.strokeStyle = '#556B2F'; // Màu viền đất
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, canvasHeight); // Bắt đầu từ góc dưới trái

    let lastY = canvasHeight;
    for (let x = 0; x < canvasWidth; x += TERRAIN_RESOLUTION) {
        const y = getTerrainHeight(x);
        ctx.lineTo(x, y);
        lastY = y;
    }
    ctx.lineTo(canvasWidth, lastY); // Đến điểm cuối cùng trên mặt đất
    ctx.lineTo(canvasWidth, canvasHeight); // Xuống góc dưới phải
    ctx.closePath();
    ctx.fill();
    // ctx.stroke(); // Vẽ viền nếu muốn

     // Thêm lớp đất sẫm màu hơn bên dưới
     ctx.fillStyle = '#8B4513'; // Màu đất nâu
     ctx.beginPath();
     ctx.moveTo(0, canvasHeight);
     lastY = canvasHeight;
     for (let x = 0; x < canvasWidth; x += TERRAIN_RESOLUTION) {
         const y = getTerrainHeight(x) + 15; // Lớp đất dày 15px
         ctx.lineTo(x, Math.min(canvasHeight, y)); // Không vẽ vượt quá đáy
         lastY = Math.min(canvasHeight, y);
     }
     ctx.lineTo(canvasWidth, lastY);
     ctx.lineTo(canvasWidth, canvasHeight);
     ctx.closePath();
     ctx.fill();
}


function drawTankObject(tankObj) {
    // --- CẬP NHẬT VỊ TRÍ Y CỦA XE TĂNG THEO ĐỊA HÌNH ---
    // Lấy độ cao dưới tâm xe tăng
    const terrainY = getTerrainHeight(tankObj.x + tankObj.width / 2);
    tankObj.y = terrainY; // Đáy xe tăng đặt trên mặt đất
    // --- HẾT CẬP NHẬT Y ---

    // Vẽ thân xe (giữ nguyên)
    ctx.fillStyle = tankObj.color; ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);
    ctx.fillStyle = '#6c757d'; ctx.fillRect(tankObj.x, tankObj.y - tankObj.height * 0.4, tankObj.width, tankObj.height * 0.4);
    ctx.fillStyle = '#495057'; const treadWidth = tankObj.width / 6;
    for (let i = 0; i < 6; i++) { ctx.fillRect(tankObj.x + i * treadWidth, tankObj.y - tankObj.height * 0.4, treadWidth * 0.8, tankObj.height * 0.4); }

    // Vẽ nòng súng (giữ nguyên)
    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset ?? tankObj.width / 2);
    // Vị trí Y của trục xoay nòng giờ phụ thuộc vào vị trí Y mới của xe tăng
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset ?? 0) - 3;
    ctx.translate(pivotX, pivotY); ctx.rotate(tankObj.turret.angle); ctx.fillStyle = tankObj.turret.color;
    ctx.beginPath(); ctx.moveTo(0, -tankObj.turret.width * 0.7); ctx.lineTo(tankObj.turret.length * 0.6, -tankObj.turret.width * 0.5); ctx.lineTo(tankObj.turret.length, -tankObj.turret.width * 0.4); ctx.lineTo(tankObj.turret.length, tankObj.turret.width * 0.4); ctx.lineTo(tankObj.turret.length * 0.6, tankObj.turret.width * 0.5); ctx.lineTo(0, tankObj.turret.width * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Vẽ thanh máu (giữ nguyên, vị trí Y giờ cũng theo xe tăng)
    const healthBarWidth = tankObj.width; const healthBarHeight = 6; const healthBarX = tankObj.x; const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 5;
    const currentHealthWidth = Math.max(0, (tankObj.health / tankObj.maxHealth) * healthBarWidth);
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > (tankObj.maxHealth * 0.3) ? '#28a745' : '#dc3545'; ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
    ctx.strokeStyle = '#adb5bd'; ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
}

function drawBullets() { /* Giữ nguyên */ }

// --- Update Functions ---
function updatePlayerTank() { /* Giữ nguyên logic di chuyển X */ }

function updateEnemyTank() {
    if (enemyTank.isMoving) {
        const moveDirection = Math.sign(enemyTank.moveTargetX - enemyTank.x);
        const nextX = enemyTank.x + moveDirection * ENEMY_MOVE_SPEED;

        // Kiểm tra xem vị trí X mới có hợp lệ trên địa hình không
        // (Ở đây chỉ kiểm tra biên, chưa kiểm tra vách núi dựng đứng)
        const boundedNextX = Math.max(0, Math.min(canvasWidth - enemyTank.width, nextX));

        if (boundedNextX !== nextX) { // Nếu bị chặn bởi biên màn hình
             enemyTank.isMoving = false; // Dừng lại
             if (gameState === 'ENEMY_TURN_MOVE') { gameState = 'ENEMY_TURN'; enemyAI(); }
        } else {
            enemyTank.x = boundedNextX;
             // Cập nhật Y ngay lập tức khi di chuyển (để vẽ đúng)
            enemyTank.y = getTerrainHeight(enemyTank.x + enemyTank.width / 2);

             if (Math.abs(enemyTank.x - enemyTank.moveTargetX) < ENEMY_MOVE_SPEED) {
                enemyTank.x = enemyTank.moveTargetX;
                enemyTank.y = getTerrainHeight(enemyTank.x + enemyTank.width / 2); // Cập nhật Y lần cuối
                enemyTank.isMoving = false;
                if (gameState === 'ENEMY_TURN_MOVE') { gameState = 'ENEMY_TURN'; enemyAI(); }
            }
        }
    }
}


function updateBullets() {
    if (bullets.length === 0) { if (gameState === 'BULLET_FLYING') { switchTurn(); } return; }
    if (gameState !== 'BULLET_FLYING') return;

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const ax_total = windAcceleration; const ay_total = GRAVITY_ACCELERATION;
        bullet.vx += ax_total; bullet.vy += ay_total;
        bullet.x += bullet.vx; bullet.y += bullet.vy;

        // --- KIỂM TRA VA CHẠM ĐẠN - ĐỊA HÌNH ---
        const terrainY = getTerrainHeight(bullet.x);
        if (bullet.y >= terrainY) {
            bullets.splice(i, 1);
            // TODO: Thêm hiệu ứng nổ đất
            // console.log("Bullet hit terrain");
            continue; // Xử lý viên đạn tiếp theo
        }
        // --- HẾT KIỂM TRA VA CHẠM ĐỊA HÌNH ---

        let hitTargetTank = null; let damage = 0;
        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) { hitTargetTank = enemyTank; damage = Math.floor(Math.random() * 11) + 20; }
        else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) { hitTargetTank = tank; damage = enemyTank.baseDamage + Math.floor(Math.random() * (enemyTank.damageRange + 1)); }
        if (hitTargetTank) { bullets.splice(i, 1); dealDamage(hitTargetTank, damage); continue; }
        // Bỏ kiểm tra va chạm đất y > canvasHeight vì đã có va chạm địa hình
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) { bullets.splice(i, 1); }
    }
    if (bullets.length === 0) { switchTurn(); }
}


function checkCollision(bullet, targetTank) { /* Giữ nguyên */ }
function dealDamage(targetTank, amount) { /* Giữ nguyên */ }

// --- AI Logic ---
function simulateShot(startX, startY, angleRad, velocity, targetTank) {
    let simX = startX; let simY = startY; let simVx = Math.cos(angleRad) * velocity; let simVy = Math.sin(angleRad) * velocity; let steps = 0;
    while (steps < MAX_SIMULATION_STEPS) { // Bỏ điều kiện simY <= canvasHeight + 100
        const ax_total = windAcceleration; const ay_total = GRAVITY_ACCELERATION;
        simVx += ax_total; simVy += ay_total; simX += simVx; simY += simVy;

        // --- KIỂM TRA VA CHẠM ĐỊA HÌNH TRONG MÔ PHỎNG ---
        const terrainY = getTerrainHeight(simX);
        if (simY >= terrainY) {
            return { hit: false, x: simX, y: simY, steps: steps, hitTerrain: true }; // Thêm cờ báo chạm đất
        }
        // --- HẾT KIỂM TRA VA CHẠM ĐỊA HÌNH ---

        // Kiểm tra va chạm mục tiêu
        const simBullet = { x: simX, y: simY, radius: 3 };
        if (checkCollision(simBullet, targetTank)) {
            return { hit: true, x: simX, y: simY, steps: steps, hitTerrain: false };
        }

        // Kiểm tra bay ra ngoài màn hình (để dừng sớm)
         if (simX < -50 || simX > canvasWidth + 50 || simY < -canvasHeight) { // Thoát sớm nếu bay quá xa
            break;
         }

        steps++;
    }
    // Nếu hết step mà chưa chạm gì
    return { hit: false, x: simX, y: simY, steps: steps, hitTerrain: false };
}


function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return;
    setMessage("Địch đang tính toán..."); updateUI();

    setTimeout(() => {
        if (gameState !== 'ENEMY_TURN' || gameOver || enemyTank.isMoving) return;
        const sourcePivotX = enemyTank.x + (enemyTank.turret.pivotXOffset ?? enemyTank.width / 2);
        const sourcePivotY = enemyTank.y - enemyTank.height + (enemyTank.turret.pivotYOffset ?? 0) - 3; // Vị trí trục xoay nòng địch
        const targetX = tank.x + tank.width / 2; const targetY = tank.y - tank.height / 2;

        let bestShot = { angle: -Math.PI / 2, power: 10, closestDistSq: Infinity, hit: false };
        const angleStep = Math.PI / 180 * 1.2; const powerStep = 1.2; const minPower = 9; const maxPower = 26;

        for (let power = minPower; power <= maxPower; power += powerStep) {
            for (let angle = -Math.PI * 0.95; angle < -Math.PI * 0.05; angle += angleStep) {
                 // Tính vị trí đầu nòng địch ứng với góc đang thử
                 const muzzleX = sourcePivotX + Math.cos(angle) * enemyTank.turret.length;
                 const muzzleY = sourcePivotY + Math.sin(angle) * enemyTank.turret.length;

                const simResult = simulateShot(muzzleX, muzzleY, angle, power, tank);

                // *** AI ƯU TIÊN BẮN TRÚNG VÀ KHÔNG CHẠM ĐẤT TRƯỚC ***
                if (simResult.hit && !simResult.hitTerrain) {
                    bestShot = { angle: angle, power: power, closestDistSq: 0, hit: true };
                    break;
                } else if (!simResult.hitTerrain) { // Nếu không chạm đất nhưng cũng không trúng
                    const dx = simResult.x - targetX;
                    const distSq = dx * dx * 1.5 + (simResult.y - targetY) * (simResult.y - targetY);
                    if (distSq < bestShot.closestDistSq && !bestShot.hit) { // Chỉ cập nhật nếu chưa tìm được cú trúng đích
                         bestShot = { angle: angle, power: power, closestDistSq: distSq, hit: false };
                    }
                }
                // Bỏ qua những cú bắn chạm đất sớm
            }
            if (bestShot.hit) break;
        }

        // ... (Phần xử lý sai số và bắn giữ nguyên) ...
         let finalAngle = bestShot.angle; let finalPower = bestShot.power;
        const errorMagnitude = enemyTank.aimAccuracyError * (Math.PI / 4);
        finalAngle += (Math.random() - 0.5) * 2 * errorMagnitude;
        finalPower += (Math.random() - 0.5) * (maxPower * 0.1 * enemyTank.aimAccuracyError);
        const minEnemyAngle = -Math.PI * 0.95; const maxEnemyAngle = -Math.PI * 0.05;
        enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, finalAngle));
        setMessage("Địch bắn!"); fireBullet(enemyTank, Math.max(minPower, finalPower));

    }, 50);
}

// --- Game Logic ---
function fireBullet(shooterTank, power) { /* ... (Tính muzzleX, muzzleY dựa trên vị trí Y mới của tank) ... */
    const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset ?? shooterTank.width / 2);
    const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset ?? 0) - 3; // Dùng Y hiện tại
    const angle = shooterTank.turret.angle;
    const muzzleX = pivotX + Math.cos(angle) * shooterTank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * shooterTank.turret.length;
    const vx = Math.cos(angle) * power; const vy = Math.sin(angle) * power;
    bullets.push({ owner: shooterTank.id, x: muzzleX, y: muzzleY, vx: vx, vy: vy, radius: 4 });
    lastShooterId = shooterTank.id; gameState = 'BULLET_FLYING'; updateUI();
    if (shooterTank.id === 'player') { tank.canFire = false; setTimeout(() => { if (gameState === 'PLAYER_TURN' || gameState === 'LEVEL_START') { tank.canFire = true; } }, playerFireCooldown); }
 }
function handleFireInput() { /* Giữ nguyên */ }
function startEnemyMovement() { /* Giữ nguyên */ }
function switchTurn() { /* Giữ nguyên */ }
function handleGameOver(playerWins) { /* Giữ nguyên */ }

function loadLevel(levelIndex) {
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }
    if (levelIndex >= levels.length) { /* ... hết level ... */ return; }
    const levelData = levels[levelIndex]; currentLevel = levelIndex; gameOver = false; gameState = 'LEVEL_START';

    // *** TẠO ĐỊA HÌNH TRƯỚC KHI ĐẶT XE TĂNG ***
    generateTerrain(); // Tạo địa hình mới cho mỗi level

    // Reset Player (Y sẽ được cập nhật trong drawTankObject)
    tank.health = tank.maxHealth; tank.x = 50; // Chỉ reset X
    angleInput.value = 45; velocityInput.value = 15; tank.turret.angle = -(45 * Math.PI / 180);
    angleVisual.textContent = `(45°)`; velocityVisual.textContent = `(15.0)`;
    tank.canFire = true; tank.isMovingLeft = false; tank.isMovingRight = false;

    // Setup Enemy (Y sẽ được cập nhật trong drawTankObject)
    enemyTank.maxHealth = Math.floor(100 * levelData.enemyHealthMultiplier); enemyTank.health = enemyTank.maxHealth;
    enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
    enemyTank.aimAccuracyError = levelData.aimError; enemyTank.isMoving = false;
    // Ngắm sơ bộ (Y của tank chưa đúng ở đây, nhưng sẽ được cập nhật khi vẽ)
    // enemyTank.turret.angle = ... (có thể bỏ qua ngắm ở đây, AI sẽ tự ngắm)

    windAcceleration = levelData.wind || 0;
    bullets = []; setMessage(`Level ${currentLevel + 1} bắt đầu!`); updateUI(); // updateUI sẽ gọi updatePhysicsData

    // Bắt đầu lượt chơi
    setTimeout(() => { if (!gameOver && gameState === 'LEVEL_START') { gameState = 'PLAYER_TURN'; lastShooterId = 'enemy'; setMessage("Lượt của Bạn"); updatePhysicsDataDisplay(); updateUI(); } }, 1500);
}

function nextLevel() { loadLevel(currentLevel + 1); }

// --- UI Update Functions ---
function updatePhysicsDataDisplay() {
    if (gameOver || gameState !== 'PLAYER_TURN') { physicsDataDiv.setAttribute('data-inactive', 'true'); return; }
    physicsDataDiv.removeAttribute('data-inactive');

    // *** TÍNH TOÁN VỊ TRÍ DỰA TRÊN Y HIỆN TẠI CỦA TANK ***
    const playerTankY = getTerrainHeight(tank.x + tank.width/2); // Lấy Y thực tế
    const pivotX = tank.x + tank.turret.pivotXOffset;
    const pivotY = playerTankY - tank.height + tank.turret.pivotYOffset - 3; // Dùng Y thực tế
    const angle = tank.turret.angle;
    const muzzleX = pivotX + Math.cos(angle) * tank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * tank.turret.length;

    const enemyTankY = getTerrainHeight(enemyTank.x + enemyTank.width/2); // Lấy Y thực tế địch
    const targetX = enemyTank.x + enemyTank.width / 2;
    const targetY = enemyTankY - enemyTank.height / 2; // Tâm địch theo Y thực tế

    muzzlePosDisplay.textContent = `(${muzzleX.toFixed(1)}, ${muzzleY.toFixed(1)})`;
    targetPosDisplay.textContent = `(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`;
    gravityValDisplay.textContent = GRAVITY_ACCELERATION.toFixed(3);
    windValDisplay.textContent = windAcceleration.toFixed(4);
    // Không hiển thị drag
}

function updateUI() { /* ... (Giữ nguyên, đảm bảo gọi updatePhysicsDataDisplay cuối cùng) ... */
    // ... (cập nhật level, máu, lượt, gió, input visual)
    updatePhysicsDataDisplay(); // Gọi cuối để lấy Y mới nhất
}
function setMessage(msg, isSuccess = false) { /* ... Giữ nguyên ... */ }

// --- Main Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // *** VẼ ĐỊA HÌNH TRƯỚC ***
    drawTerrain();

    if (!gameOver) {
        updatePlayerTank(); // Cập nhật X player
        updateEnemyTank();  // Cập nhật X enemy (nếu đang di chuyển)
        updateBullets();    // Cập nhật đạn và va chạm
    }

    // *** VẼ XE TĂNG SAU (để Y được cập nhật đúng) ***
    drawTankObject(tank);
    drawTankObject(enemyTank);
    drawBullets(); // Vẽ đạn trên cùng

    requestAnimationFrame(gameLoop);
}

// --- Event Listeners Setup ---
function setupEventListeners() { /* ... Giữ nguyên ... */ }

// --- Initialization ---
function resizeCanvas() {
    // Lưu state cũ
    const currentTankHealth = tank.health; const currentEnemyHealth = enemyTank.health;
    const currentGameState = gameState; const currentGameOver = gameOver;
    const currentLastShooter = lastShooterId; const currentBullets = bullets.map(b => ({ ...b }));
    const currentAngle = angleInput.value; const currentVelocity = velocityInput.value;
    const currentTankAngle = tank.turret.angle; const currentEnemyIsMoving = enemyTank.isMoving;
    const currentEnemyMoveTarget = enemyTank.moveTargetX;
    const currentTankX = tank.x; // Lưu cả vị trí X
    const currentEnemyX = enemyTank.x;

    // Resize canvas
    const container = document.getElementById('game-container'); const style = window.getComputedStyle(container);
    const width = parseInt(style.width); const height = parseInt(style.height);
    canvas.width = width; canvas.height = height; canvasWidth = canvas.width; canvasHeight = canvas.height;

    // *** TẠO LẠI ĐỊA HÌNH SAU KHI RESIZE ***
    generateTerrain();

    // Khôi phục state cũ (Y sẽ tự cập nhật khi vẽ)
    if (!currentGameOver && currentGameState !== 'LEVEL_START') {
        tank.x = currentTankX; // Khôi phục X
        enemyTank.x = currentEnemyX; // Khôi phục X
        tank.health = currentTankHealth; enemyTank.health = currentEnemyHealth; gameState = currentGameState; gameOver = currentGameOver;
        lastShooterId = currentLastShooter; bullets = currentBullets; angleInput.value = currentAngle; velocityInput.value = currentVelocity;
        tank.turret.angle = currentTankAngle; enemyTank.isMoving = currentEnemyIsMoving; enemyTank.moveTargetX = currentEnemyMoveTarget;
        if(angleVisual) angleVisual.textContent = `(${parseFloat(currentAngle).toFixed(0)}°)`;
        if(velocityVisual) velocityVisual.textContent = `(${parseFloat(currentVelocity).toFixed(1)})`;
        bullets.forEach(b => { /* Có thể cần điều chỉnh Y đạn tương đối? Hoặc để tự nhiên */ });
        updateUI();
    } else {
        loadLevel(currentLevel); // Load lại level nếu game over/start (sẽ tạo địa hình mới)
    }
}


// --- Start the game ---
// (Kiểm tra null vẫn giữ nguyên)
if (!canvas || !ctx /* ... */ ) { /* ... lỗi ... */ }
else {
    setupEventListeners();
    resizeCanvas(); // generateTerrain sẽ được gọi bên trong
    gameLoop();
                    }
