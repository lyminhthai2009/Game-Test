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
const windIndicator = document.getElementById('wind-indicator');

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = [];
let wind = 0;
let gameOver = false;
let gameState = 'LEVEL_START';
let lastShooterId = 'enemy';
let switchTurnTimeout = null; // KHAI BÁO Ở ĐÂY

// --- Game Constants ---
const gravity = 0.15;
const enemyFireDelay = 1500;
const turnSwitchDelay = 800;
const playerFireCooldown = 500;
const MAX_SIMULATION_STEPS = 300;

// --- Player Tank Definition ---
const tank = {
    id: 'player',
    x: 50,
    y: 0,
    width: 50,
    height: 25,
    color: '#5CB85C',
    speed: 2.5,
    turret: {
        length: 35,
        width: 8,
        angle: -(45 * Math.PI / 180), // Góc trực quan ban đầu (45 độ)
        color: '#4CAF50',
        pivotXOffset: 25,
        pivotYOffset: 0
    },
    health: 100,
    maxHealth: 100,
    isMovingLeft: false,
    isMovingRight: false,
    canFire: true,
};

// --- Enemy Tank Definition ---
const enemyTank = {
    id: 'enemy',
    x: 0,
    y: 0,
    width: 50,
    height: 25,
    color: '#D9534F',
    turret: {
        length: 35,
        width: 8,
        angle: -3 * Math.PI / 4,
        color: '#C9302C',
    },
    health: 100,
    maxHealth: 100,
    aimAccuracyError: 0.1, // Sẽ được ghi đè bởi level config
    baseDamage: 25, // Sát thương địch cơ bản
    damageRange: 15, // Phạm vi random thêm (25-40)
};

// --- Level Definitions ---
const levels = [
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.0, wind: 0,      aimError: 0.15 }, // Level 1: Dễ
    { enemyXRatio: 0.8,  enemyHealthMultiplier: 1.1, wind: 0.01,   aimError: 0.10 },
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 1.2, wind: -0.015, aimError: 0.07 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 1.4, wind: 0.025,  aimError: 0.05 },
    { enemyXRatio: 0.8,  enemyHealthMultiplier: 1.7, wind: -0.035, aimError: 0.03 }, // Khó hơn
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 2.2, wind: 0.045,  aimError: 0.02 }, // Rất khó
    { enemyXRatio: 0.7,  enemyHealthMultiplier: 3.0, wind: -0.055, aimError: 0.01 }, // Cực khó
];

// --- Drawing Functions ---
function drawTankObject(tankObj) {
    ctx.fillStyle = tankObj.color;
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);

    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset !== undefined ? tankObj.turret.pivotXOffset : tankObj.width / 2);
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset !== undefined ? tankObj.turret.pivotYOffset : 0);
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tankObj.turret.angle); // Sử dụng góc đã được cập nhật
    ctx.fillStyle = tankObj.turret.color;
    ctx.fillRect(0, -tankObj.turret.width / 2, tankObj.turret.length, tankObj.turret.width);
    ctx.restore();

    // Thanh máu
    const healthBarWidth = tankObj.width;
    const healthBarHeight = 5;
    const healthBarX = tankObj.x;
    const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 3;
    const currentHealthWidth = Math.max(0, (tankObj.health / tankObj.maxHealth) * healthBarWidth);

    ctx.fillStyle = '#ddd';
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > (tankObj.maxHealth * 0.3) ? '#4CAF50' : '#f44336';
    ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
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
        tank.isMovingLeft = false;
        tank.isMovingRight = false;
        return;
    }
    // Di chuyển
    if (tank.isMovingLeft) {
        const nextX = tank.x - tank.speed;
        if (nextX >= 0) { tank.x = nextX; }
    }
    if (tank.isMovingRight) {
        const nextX = tank.x + tank.speed;
        if (nextX <= canvasWidth - tank.width) { tank.x = nextX; }
    }
    // Góc nòng được cập nhật qua input event
}

function updateBullets() {
    if (bullets.length === 0) {
        if (gameState === 'BULLET_FLYING') { switchTurn(); }
        return;
    }
    if (gameState !== 'BULLET_FLYING') return;

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.vy += gravity;
        bullet.vx += wind;
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        let hitTargetTank = null;
        let damage = 0;

        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) {
            hitTargetTank = enemyTank;
            damage = Math.floor(Math.random() * 11) + 20; // Player: 20-30
        } else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) {
            hitTargetTank = tank;
            damage = enemyTank.baseDamage + Math.floor(Math.random() * (enemyTank.damageRange + 1)); // Enemy: 25-40
        }

        if (hitTargetTank) {
            bullets.splice(i, 1);
            dealDamage(hitTargetTank, damage);
            continue;
        }
        if (bullet.y + bullet.radius > canvasHeight) {
            bullets.splice(i, 1);
            continue;
        }
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) {
            bullets.splice(i, 1);
        }
    }
    if (bullets.length === 0) {
        switchTurn();
    }
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
    if (targetTank.health <= 0) {
        targetTank.health = 0;
    }
    updateUI();
}

// --- AI Logic ---
function simulateShot(startX, startY, angleRad, velocity, targetTank) {
    let simX = startX;
    let simY = startY;
    let simVx = Math.cos(angleRad) * velocity;
    let simVy = Math.sin(angleRad) * velocity;
    let steps = 0;

    while (simY <= canvasHeight + 50 && steps < MAX_SIMULATION_STEPS) { // Cho phép đi xuống dưới 1 chút
        simVy += gravity;
        simVx += wind;
        simX += simVx;
        simY += simVy;

        const simBullet = { x: simX, y: simY, radius: 2 };
        if (checkCollision(simBullet, targetTank)) {
            return { hit: true, x: simX, y: simY, steps: steps };
        }
        steps++;
    }
    return { hit: false, x: simX, y: simY, steps: steps };
}

function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver) return;
    setMessage("Địch đang tính toán...");
    updateUI();

    setTimeout(() => {
        if (gameState !== 'ENEMY_TURN' || gameOver) return;

        const sourceX = enemyTank.x + enemyTank.width / 2;
        const sourceY = enemyTank.y - enemyTank.height / 2;
        const targetX = tank.x + tank.width / 2;
        const targetY = tank.y - tank.height / 2;

        let bestShot = { angle: -Math.PI / 2, power: 10, closestDistSq: Infinity, hit: false };

        const angleStep = Math.PI / 180 * 1.5; // Bước góc nhỏ hơn để chính xác hơn
        const powerStep = 1.0;
        const minPower = 8;
        const maxPower = 24; // Giới hạn lực bắn AI

        for (let power = minPower; power <= maxPower; power += powerStep) {
            for (let angle = -Math.PI * 0.95; angle < -Math.PI * 0.05; angle += angleStep) {
                const simResult = simulateShot(sourceX, sourceY, angle, power, tank);

                if (simResult.hit) {
                    bestShot = { angle: angle, power: power, closestDistSq: 0, hit: true };
                    // console.log(`AI HIT: A=${(angle * 180 / Math.PI).toFixed(1)} P=${power.toFixed(1)}`);
                    break; // Thoát vòng góc
                } else {
                    const dx = simResult.x - targetX;
                    // Ưu tiên bắn gần theo phương ngang hơn là dọc
                    const distSq = dx * dx * 1.5 + (simResult.y - targetY) * (simResult.y - targetY);

                    if (distSq < bestShot.closestDistSq) {
                         bestShot = { angle: angle, power: power, closestDistSq: distSq, hit: false };
                         // console.log(`AI CLOSE: A=${(angle * 180 / Math.PI).toFixed(1)} P=${power.toFixed(1)} D=${Math.sqrt(distSq).toFixed(0)}`);
                    }
                }
            }
            if (bestShot.hit) break; // Thoát vòng lực
        }

        let finalAngle = bestShot.angle;
        let finalPower = bestShot.power;

        // Thêm sai số
        const errorMagnitude = enemyTank.aimAccuracyError * (Math.PI / 5); // Scale sai số theo PI/5 radian
        finalAngle += (Math.random() - 0.5) * 2 * errorMagnitude;

        // Giới hạn lại góc
        const minEnemyAngle = -Math.PI * 0.95;
        const maxEnemyAngle = -Math.PI * 0.05;
        enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, finalAngle));

        setMessage("Địch bắn!");
        fireBullet(enemyTank, finalPower);

    }, 50); // Delay nhỏ cho tính toán
}

// --- Game Logic ---
function fireBullet(shooterTank, power) {
    const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset !== undefined ? shooterTank.turret.pivotXOffset : shooterTank.width / 2);
    const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset !== undefined ? shooterTank.turret.pivotYOffset : 0);
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
            // Kiểm tra lại gameState trước khi bật lại nút bắn
            if (gameState === 'PLAYER_TURN' || gameState === 'LEVEL_START') {
                 tank.canFire = true;
            }
        }, playerFireCooldown);
    }
}

function handleFireInput() {
    if (gameState === 'PLAYER_TURN' && tank.canFire && !gameOver) {
        const angleDeg = parseFloat(angleInput.value);
        const velocity = parseFloat(velocityInput.value);

        if (isNaN(angleDeg) || angleDeg < 0 || angleDeg > 90 || isNaN(velocity) || velocity < 1 || velocity > 25) {
            setMessage("Giá trị Góc/Lực không hợp lệ!", false);
            return;
        }

        // Góc nòng đã được cập nhật qua 'input' event listener, chỉ cần bắn
        setMessage("");
        fireBullet(tank, velocity);
    }
}

function switchTurn() {
    if (switchTurnTimeout) return;
    if (gameState !== 'BULLET_FLYING' || bullets.length > 0) return;

    switchTurnTimeout = setTimeout(() => {
        switchTurnTimeout = null;
        if (gameOver) return;

        // Kiểm tra thắng/thua trước khi đổi lượt
        if (enemyTank.health <= 0) { handleGameOver(true); return; }
        if (tank.health <= 0) { handleGameOver(false); return; }

        if (lastShooterId === 'player') {
            gameState = 'ENEMY_TURN';
            setMessage("Lượt của Địch");
            updateUI();
            enemyAI();
        } else {
            gameState = 'PLAYER_TURN';
            tank.canFire = true; // Bật lại khả năng bắn cho player
            setMessage("Lượt của Bạn");
            updateUI();
        }
    }, turnSwitchDelay);
}

function handleGameOver(playerWins) {
    if (gameOver) return;
    gameOver = true;
    gameState = 'GAME_OVER';
    setMessage(playerWins ? "CHIẾN THẮNG!" : "THẤT BẠI!", playerWins);
    updateUI();
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }

    const delay = playerWins ? 2500 : 3000;
    setTimeout(() => {
        if (playerWins) {
            if (currentLevel < levels.length - 1) { nextLevel(); }
            else { setMessage("Bạn đã hoàn thành tất cả các màn!", true); }
        } else {
            loadLevel(currentLevel); // Chơi lại màn hiện tại nếu thua
        }
    }, delay);
}

function loadLevel(levelIndex) {
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }
    if (levelIndex >= levels.length) {
        setMessage("Bạn đã hoàn thành tất cả các màn!", true);
        gameOver = true; gameState = 'GAME_OVER'; updateUI(); return;
    }

    const levelData = levels[levelIndex];
    currentLevel = levelIndex;
    gameOver = false;
    gameState = 'LEVEL_START';

    // Reset Player
    tank.health = tank.maxHealth;
    tank.x = 50;
    tank.y = canvasHeight; // Đặt Y sau khi có canvasHeight
    angleInput.value = 45; // Reset input
    velocityInput.value = 15; // Reset input
    tank.turret.angle = -(45 * Math.PI / 180); // Reset góc trực quan
    angleVisual.textContent = `(45°)`; // Reset hiển thị
    velocityVisual.textContent = `(15.0)`; // Reset hiển thị
    tank.canFire = true;

    // Setup Enemy
    enemyTank.maxHealth = Math.floor(100 * levelData.enemyHealthMultiplier);
    enemyTank.health = enemyTank.maxHealth;
    enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
    enemyTank.y = canvasHeight; // Đặt Y sau khi có canvasHeight
    enemyTank.aimAccuracyError = levelData.aimError; // LẤY ĐỘ KHÓ TỪ LEVEL
    // Ngắm sơ bộ địch
    enemyTank.turret.angle = Math.atan2(tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2), tank.x + tank.width/2 - (enemyTank.x + enemyTank.width/2));
    if (enemyTank.turret.angle > -Math.PI * 0.1) enemyTank.turret.angle = -Math.PI * 0.1; // Giới hạn góc ngắm ban đầu của địch
    if (enemyTank.turret.angle < -Math.PI * 0.9) enemyTank.turret.angle = -Math.PI * 0.9;


    // Đặt gió
    wind = levelData.wind || 0;

    // Reset khác
    bullets = [];

    setMessage(`Level ${currentLevel + 1} bắt đầu!`);
    updateUI();

    // Bắt đầu lượt chơi
    setTimeout(() => {
        if (!gameOver && gameState === 'LEVEL_START') {
             gameState = 'PLAYER_TURN';
             lastShooterId = 'enemy'; // Reset last shooter
             setMessage("Lượt của Bạn");
             updateUI();
        }
    }, 1500);
}

function nextLevel() {
    loadLevel(currentLevel + 1);
}

// --- UI Update Functions ---
function updateUI() {
    levelDisplay.textContent = currentLevel + 1;
    playerHealthDisplay.textContent = `Player: ${tank.health}/${tank.maxHealth}`;
    enemyHealthDisplay.textContent = `Enemy: ${enemyTank.health}/${enemyTank.maxHealth}`;

    let turnText = ""; let turnColor = "#333";
    switch (gameState) {
        case 'PLAYER_TURN': turnText = "Lượt của Bạn"; turnColor = tank.color; break;
        case 'ENEMY_TURN': turnText = "Lượt của Địch"; turnColor = enemyTank.color; break;
        case 'BULLET_FLYING': turnText = "Đạn đang bay..."; turnColor = '#555'; break;
        case 'GAME_OVER': turnText = "Game Over"; turnColor = '#000'; break;
        case 'LEVEL_START': turnText = "Chuẩn bị..."; turnColor = '#555'; break;
    }
    turnDisplay.textContent = turnText;
    turnDisplay.style.color = turnColor;

    if (wind !== 0 && !gameOver) {
        windIndicator.textContent = `Gió: ${wind > 0 ? '>>' : '<<'} ${Math.abs(wind * 100).toFixed(0)}`;
    } else { windIndicator.textContent = ""; }
    // Cập nhật hiển thị input nếu giá trị trong input khác với hiển thị (phòng trường hợp load lại)
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
     else if (msg.includes("trúng đạn")) { msgColor = '#e65c00'; } // Màu cam cho bắn trúng
    messageDisplay.style.color = msgColor;
}

// --- Main Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!gameOver) {
         updatePlayerTank(); // Chỉ cập nhật di chuyển player
         updateBullets();
    }
    // Vẽ lại mọi thứ
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
             tank.turret.angle = angleRad; // Cập nhật góc nòng trực quan
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
    const currentTankHealth = tank.health;
    const currentEnemyHealth = enemyTank.health;
    const currentGameState = gameState;
    const currentGameOver = gameOver;
    const currentLastShooter = lastShooterId;
    const currentBullets = bullets.map(b => ({ ...b }));
    const currentAngle = angleInput.value;
    const currentVelocity = velocityInput.value;
    const currentTankAngle = tank.turret.angle;

    const container = document.getElementById('game-container');
    const style = window.getComputedStyle(container);
    const width = parseInt(style.width);
    const height = parseInt(style.height);
    canvas.width = width; canvas.height = height;
    canvasWidth = canvas.width; canvasHeight = canvas.height;

    tank.y = canvasHeight; enemyTank.y = canvasHeight;

    if (!currentGameOver && currentGameState !== 'LEVEL_START') {
        const levelData = levels[currentLevel];
        enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;

        tank.health = currentTankHealth;
        enemyTank.health = currentEnemyHealth;
        gameState = currentGameState;
        gameOver = currentGameOver;
        lastShooterId = currentLastShooter;
        bullets = currentBullets;
        angleInput.value = currentAngle;
        velocityInput.value = currentVelocity;
        tank.turret.angle = currentTankAngle; // Khôi phục góc trực quan
        // Cập nhật hiển thị text sau khi khôi phục giá trị input
        angleVisual.textContent = `(${parseFloat(currentAngle).toFixed(0)}°)`;
        velocityVisual.textContent = `(${parseFloat(currentVelocity).toFixed(1)})`;


        bullets.forEach(b => { if (b.y > canvasHeight) b.y = canvasHeight - b.radius; });
        updateUI();
    } else {
        loadLevel(currentLevel);
    }
}

// --- Start the game ---
setupEventListeners();
resizeCanvas();      // Chạy lần đầu để lấy kích thước và load level 0
gameLoop();          // Bắt đầu vòng lặp
