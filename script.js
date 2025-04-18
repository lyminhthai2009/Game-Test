const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- DOM Elements ---
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnTurretUp = document.getElementById('btn-turret-up');
const btnTurretDown = document.getElementById('btn-turret-down');
const btnFire = document.getElementById('btn-fire');
const levelDisplay = document.getElementById('level-display');
const messageDisplay = document.getElementById('message-display');
const playerHealthDisplay = document.createElement('div'); // Hiển thị máu Player
const enemyHealthDisplay = document.createElement('div'); // Hiển thị máu Enemy
const turnDisplay = document.createElement('div'); // Hiển thị lượt chơi

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = [];
let obstacles = []; // Chỉ dùng cho chế độ mục tiêu cũ, giờ không cần
let wind = 0; // Giữ lại gió nếu muốn
let gameOver = false;
let gameState = 'LEVEL_START'; // PLAYER_TURN, ENEMY_TURN, BULLET_FLYING, GAME_OVER, LEVEL_START

const gravity = 0.15;
const initialBulletVelocity = 11; // Tăng nhẹ
const enemyFireDelay = 1500; // Thời gian địch chờ trước khi bắn (ms)
const turnSwitchDelay = 1000; // Thời gian chờ trước khi chuyển lượt (ms)

// --- Player Tank Definition ---
const tank = {
    id: 'player',
    x: 50,
    y: 0,
    width: 50,
    height: 25,
    color: '#5CB85C', // Player màu xanh lá
    speed: 2.5, // Tăng tốc độ chút
    turret: {
        length: 35,
        width: 8,
        angle: -Math.PI / 6,
        color: '#4CAF50',
        angleSpeed: 0.03,
        pivotXOffset: 25,
        pivotYOffset: 0
    },
    health: 100,
    maxHealth: 100,
    isMovingLeft: false,
    isMovingRight: false,
    isTurretMovingUp: false,
    isTurretMovingDown: false,
    canFire: true, // Sẽ kiểm tra cùng gameState
    fireCooldown: 300, // Giảm cooldown chút
};

// --- Enemy Tank Definition ---
const enemyTank = {
    id: 'enemy',
    x: 0, // Sẽ đặt lại trong loadLevel
    y: 0,
    width: 50,
    height: 25,
    color: '#D9534F', // Enemy màu đỏ cam
    turret: {
        length: 35,
        width: 8,
        angle: -5 * Math.PI / 6, // Quay về phía player
        color: '#C9302C',
        // Không cần tốc độ xoay nòng cho AI đơn giản này
    },
    health: 100,
    maxHealth: 100,
    aimAccuracyError: 0.1, // Sai số khi ngắm (radian), càng nhỏ càng chính xác
    firePowerVariation: 0.1 // % thay đổi lực bắn ngẫu nhiên
};

// --- Level Definitions (Giờ chỉ cần vị trí địch) ---
const levels = [
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.0, wind: 0 },
    { enemyXRatio: 0.8, enemyHealthMultiplier: 1.1, wind: 0.01 },
    { enemyXRatio: 0.9, enemyHealthMultiplier: 1.2, wind: -0.015 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 1.4, wind: 0.02 },
    { enemyXRatio: 0.8, enemyHealthMultiplier: 1.6, wind: -0.03 },
    // Thêm level khó hơn...
    { enemyXRatio: 0.9, enemyHealthMultiplier: 2.0, wind: 0.04 },
];

// --- Drawing Functions ---
function drawTankObject(tankObj) {
    // Thân xe
    ctx.fillStyle = tankObj.color;
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);

    // Nòng súng
    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset !== undefined ? tankObj.turret.pivotXOffset : tankObj.width / 2); // Dùng offset nếu có
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset !== undefined ? tankObj.turret.pivotYOffset : 0);
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tankObj.turret.angle);
    ctx.fillStyle = tankObj.turret.color;
    ctx.fillRect(0, -tankObj.turret.width / 2, tankObj.turret.length, tankObj.turret.width);
    ctx.restore();

    // Vẽ thanh máu
    const healthBarWidth = tankObj.width;
    const healthBarHeight = 5;
    const healthBarX = tankObj.x;
    const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 3; // Phía trên xe tăng
    const currentHealthWidth = (tankObj.health / tankObj.maxHealth) * healthBarWidth;

    ctx.fillStyle = '#ddd'; // Nền thanh máu
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > 30 ? '#4CAF50' : '#f44336'; // Màu máu (xanh/đỏ)
    ctx.fillRect(healthBarX, healthBarY, Math.max(0, currentHealthWidth), healthBarHeight); // Đảm bảo không âm
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.fillStyle = bullet.owner === 'player' ? '#333' : '#660000'; // Màu đạn khác nhau
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

// --- Update Functions ---
function updatePlayerTank() {
    if (gameState !== 'PLAYER_TURN' || gameOver) return; // Chỉ cho phép di chuyển/xoay nòng khi đến lượt và game chưa kết thúc

    // Di chuyển
    if (tank.isMovingLeft) {
        const nextX = tank.x - tank.speed;
        if (nextX >= 0) {
            tank.x = nextX;
        }
    }
    if (tank.isMovingRight) {
        const nextX = tank.x + tank.speed;
        if (nextX <= canvasWidth - tank.width) {
            tank.x = nextX;
        }
    }

    // Xoay nòng
    const minAngle = -Math.PI + 0.1; // Cho phép quay cả ra sau một chút
    const maxAngle = 0 - 0.1;        // Chỉ cho quay lên trên hoặc ngang
    if (tank.isTurretMovingUp && tank.turret.angle > minAngle) {
        tank.turret.angle -= tank.turret.angleSpeed;
    }
    if (tank.isTurretMovingDown && tank.turret.angle < maxAngle) {
        tank.turret.angle += tank.turret.angleSpeed;
    }
    tank.turret.angle = Math.max(minAngle, Math.min(maxAngle, tank.turret.angle));
}

function updateBullets() {
    if (bullets.length === 0 && gameState === 'BULLET_FLYING') {
        // Nếu không còn đạn và đang ở trạng thái đạn bay -> chuyển lượt
        switchTurn();
        return;
    }
    if (gameState !== 'BULLET_FLYING') return; // Chỉ cập nhật đạn khi đang bay

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        bullet.vy += gravity;
        bullet.vx += wind;
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        let hitTargetTank = null;
        let damage = 0;

        // Kiểm tra va chạm với xe tăng đối phương
        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) {
            hitTargetTank = enemyTank;
            damage = Math.floor(Math.random() * 10) + 20; // Sát thương ngẫu nhiên 20-29
        } else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) {
            hitTargetTank = tank;
            damage = Math.floor(Math.random() * 10) + 15; // Địch bắn yếu hơn chút (15-24)
        }

        if (hitTargetTank) {
            bullets.splice(i, 1);
            dealDamage(hitTargetTank, damage);
            // Không chuyển lượt ngay, đợi hết đạn hoặc chạm đất
            continue;
        }

        // Kiểm tra va chạm với mặt đất
        if (bullet.y + bullet.radius > canvasHeight) {
            bullets.splice(i, 1);
             // Tạo hiệu ứng nổ đất nhỏ nếu muốn
            continue;
        }

        // Xóa đạn nếu bay ra khỏi màn hình (trái, phải, trên)
        if (bullet.x < -bullet.radius || bullet.x > canvasWidth + bullet.radius || bullet.y < -canvasHeight) { // Cho bay cao hơn
            bullets.splice(i, 1);
        }
    }

     // Nếu không còn đạn nào đang bay thì mới chuyển lượt
     if (bullets.length === 0) {
        switchTurn();
    }
}

function checkCollision(bullet, targetTank) {
    // Kiểm tra va chạm đơn giản AABB (Axis-Aligned Bounding Box)
    const bulletLeft = bullet.x - bullet.radius;
    const bulletRight = bullet.x + bullet.radius;
    const bulletTop = bullet.y - bullet.radius;
    const bulletBottom = bullet.y + bullet.radius;

    const tankLeft = targetTank.x;
    const tankRight = targetTank.x + targetTank.width;
    const tankTop = targetTank.y - targetTank.height; // y là đáy
    const tankBottom = targetTank.y;

    return bulletRight > tankLeft && bulletLeft < tankRight && bulletBottom > tankTop && bulletTop < tankBottom;
}

function dealDamage(targetTank, amount) {
    targetTank.health -= amount;
    setMessage(`${targetTank.id === 'player' ? 'Bạn' : 'Địch'} bị bắn trúng! (-${amount} HP)`, false);
    if (targetTank.health <= 0) {
        targetTank.health = 0; // Không để máu âm
        gameOver = true;
        gameState = 'GAME_OVER';
        setMessage(targetTank.id === 'player' ? "Bạn đã thua!" : "Bạn đã thắng!", targetTank.id !== 'player');
        // Hiện nút chơi lại hoặc chuyển level (nếu thắng)
        if (targetTank.id !== 'player') { // Nếu thắng
             setTimeout(nextLevel, 2000); // Tự động qua màn sau 2s
        }
    }
    updateUI(); // Cập nhật thanh máu ngay
}


// --- AI Logic ---
function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver) return;

    // 1. Ngắm bắn (đơn giản)
    const dx = tank.x + tank.width / 2 - (enemyTank.x + enemyTank.width / 2);
    const dy = tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2);
    // Góc lý tưởng (bỏ qua trọng lực, gió...) - chỉ là ước lượng
    let targetAngle = Math.atan2(dy, dx);

    // Thêm sai số ngẫu nhiên vào góc ngắm
    targetAngle += (Math.random() - 0.5) * 2 * enemyTank.aimAccuracyError;

    // Giới hạn góc bắn của địch (ví dụ: không bắn thẳng xuống đất)
     const minEnemyAngle = -Math.PI + 0.1; // Quay được ra sau
     const maxEnemyAngle = 0 - 0.1;      // Không chúc xuống quá
     enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, targetAngle));

    // 2. Lực bắn (hơi ngẫu nhiên)
    // Có thể tính toán lực bắn phức tạp hơn, nhưng giờ dùng cố định + ngẫu nhiên
    let firePower = initialBulletVelocity * (1 + (Math.random() - 0.5) * 2 * enemyTank.firePowerVariation);

    // 3. Bắn đạn (sau một khoảng trễ)
    setTimeout(() => {
        if (gameState === 'ENEMY_TURN' && !gameOver) { // Kiểm tra lại state phòng trường hợp game kết thúc trong lúc chờ
             fireBullet(enemyTank, firePower);
        }
    }, enemyFireDelay);
}

// --- Game Logic ---
function fireBullet(shooterTank, power = initialBulletVelocity) {
     // Tính vị trí đầu nòng
    const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset !== undefined ? shooterTank.turret.pivotXOffset : shooterTank.width / 2);
    const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset !== undefined ? shooterTank.turret.pivotYOffset : 0);
    const muzzleX = pivotX + Math.cos(shooterTank.turret.angle) * shooterTank.turret.length;
    const muzzleY = pivotY + Math.sin(shooterTank.turret.angle) * shooterTank.turret.length;

    const angle = shooterTank.turret.angle;
    const vx = Math.cos(angle) * power;
    const vy = Math.sin(angle) * power;

    bullets.push({
        owner: shooterTank.id, // Xác định chủ nhân viên đạn
        x: muzzleX,
        y: muzzleY,
        vx: vx,
        vy: vy,
        radius: 4
    });

    gameState = 'BULLET_FLYING'; // Chuyển sang trạng thái đạn bay
    setMessage(""); // Xóa thông báo cũ
    updateUI(); // Cập nhật chỉ báo lượt

    // Xử lý cooldown cho player (nếu là player bắn)
    if (shooterTank.id === 'player') {
        tank.canFire = false;
        setTimeout(() => {
            tank.canFire = true;
        }, tank.fireCooldown);
    }
}

// Hàm xử lý input bắn của người chơi
function handleFireInput() {
    if (gameState === 'PLAYER_TURN' && tank.canFire && !gameOver) {
        fireBullet(tank);
    }
}

function switchTurn() {
     if (gameOver) return;

     // Đợi một chút trước khi chuyển hẳn lượt
     setTimeout(() => {
        if (gameState === 'BULLET_FLYING') { // Chỉ chuyển nếu vẫn đang ở trạng thái đạn bay (đã hết đạn)
             if (bullets.length > 0) return; // Double check nếu có viên đạn nào đó vừa được tạo ra
             const previousTurnOwner = bullets.length > 0 ? bullets[bullets.length-1].owner : (gameState === 'PLAYER_TURN' ? 'player' : 'enemy'); // Xác định lượt trước đó khó hơn khi ko còn đạn

             if (tank.health <= 0 || enemyTank.health <= 0) {
                gameState = 'GAME_OVER';
                updateUI();
                return;
            }

            if (gameState === 'BULLET_FLYING') { // Chỉ chuyển nếu đang ở trạng thái chờ sau khi bắn
                // Xác định lượt trước đó hơi khó khi không còn viên đạn nào
                // Cách đơn giản: giả sử lượt trước là của người chơi nếu lượt hiện tại là địch và ngược lại
                // Cần cải thiện logic này nếu có nhiều đạn bay cùng lúc
                let nextState = 'PLAYER_TURN'; // Mặc định về lượt người chơi
                // Tìm viên đạn cuối cùng được bắn để biết ai bắn trước đó
                 // -> Logic này phức tạp, cách đơn giản là dựa vào state trước đó
                 // -> Hoặc đơn giản hơn: luôn chuyển lượt qua lại

                 // Tìm lượt chơi hiện tại dựa vào gameState trước khi vào BULLET_FLYING
                 // Cần một biến lưu state trước đó, ví dụ: `previousGameState`
                 // Hoặc đơn giản: cứ luân phiên
                 if (lastTurnOwner === 'player') { // Cần biến `lastTurnOwner` được set khi bắn
                      gameState = 'ENEMY_TURN';
                      enemyAI(); // Gọi AI địch
                 } else {
                     gameState = 'PLAYER_TURN';
                 }
                  updateUI();
            }
        }
    }, turnSwitchDelay); // Chờ 1 giây trước khi đổi lượt

     // --> Cải thiện logic chuyển lượt:
     // Nên có biến lưu ai vừa bắn: lastShooterId = 'player' hoặc 'enemy'
     // Khi fireBullet, set lastShooterId = shooterTank.id
     // Trong switchTurn (sau delay):
     if (lastShooterId === 'player') {
         gameState = 'ENEMY_TURN';
         enemyAI();
     } else {
         gameState = 'PLAYER_TURN';
     }
     updateUI();
}
let lastShooterId = 'enemy'; // Giả sử địch đi trước ở màn đầu

// Trong hàm fireBullet(shooterTank, power = initialBulletVelocity):
// ... (tạo đạn)
lastShooterId = shooterTank.id; // <-- Thêm dòng này
gameState = 'BULLET_FLYING';
// ...

// Trong hàm switchTurn():
function switchTurn() {
     if (gameOver || bullets.length > 0) return; // Không chuyển nếu game over hoặc còn đạn bay

     setTimeout(() => {
        if (gameOver || bullets.length > 0) return; // Kiểm tra lại lần nữa sau delay

        if (gameState === 'BULLET_FLYING') { // Chỉ chuyển nếu đạn vừa dừng
            if (lastShooterId === 'player') {
                if (enemyTank.health <= 0) { // Kiểm tra thắng thua ngay trước khi chuyển lượt
                     handleGameOver(true); // Thắng
                     return;
                }
                gameState = 'ENEMY_TURN';
                setMessage("Lượt của Địch");
                enemyAI();
            } else { // Lượt trước là của địch
                if (tank.health <= 0) {
                    handleGameOver(false); // Thua
                    return;
                }
                gameState = 'PLAYER_TURN';
                setMessage("Lượt của Bạn");
            }
            updateUI();
        }
    }, turnSwitchDelay);
}

function handleGameOver(playerWins) {
    gameOver = true;
    gameState = 'GAME_OVER';
    setMessage(playerWins ? "Bạn đã thắng!" : "Bạn đã thua!", playerWins);
     if (playerWins) {
         // Tùy chọn: Hiện nút "Level Tiếp Theo" thay vì tự động chuyển
         setTimeout(nextLevel, 2500);
     } else {
         // Tùy chọn: Hiện nút "Chơi Lại"
     }
}


function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) {
        setMessage("Tuyệt vời! Bạn đã hoàn thành tất cả các màn!", true);
        gameOver = true;
        gameState = 'GAME_OVER';
        return;
    }

    const levelData = levels[levelIndex];
    currentLevel = levelIndex;
    levelDisplay.textContent = currentLevel + 1;
    setMessage("Level " + (currentLevel + 1));

    // Reset máu và vị trí người chơi
    tank.health = tank.maxHealth;
    tank.x = 50;
    tank.y = canvasHeight; // Đặt lại Y dựa vào chiều cao canvas
    tank.turret.angle = -Math.PI / 6;

    // Đặt máu và vị trí địch
    enemyTank.maxHealth = 100 * levelData.enemyHealthMultiplier; // Tăng máu địch theo level
    enemyTank.health = enemyTank.maxHealth;
    enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
    enemyTank.y = canvasHeight; // Đặt lại Y
    enemyTank.turret.angle = Math.atan2(tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2), tank.x + tank.width/2 - (enemyTank.x + enemyTank.width/2)); // Ngắm lại player


    // Đặt gió
    wind = levelData.wind || 0;

    // Reset trạng thái game
    bullets = [];
    gameOver = false;
    gameState = 'LEVEL_START'; // Bắt đầu level

    updateUI();

    // Bắt đầu lượt chơi sau 1 giây
    setTimeout(() => {
        // Quyết định ai đi trước (ví dụ: player luôn đi trước)
        gameState = 'PLAYER_TURN';
        lastShooterId = 'enemy'; // Để lượt sau là của địch nếu player bắn
        setMessage("Lượt của Bạn");
        updateUI();
    }, 1000);
}

function nextLevel() {
    loadLevel(currentLevel + 1);
}

// --- UI Functions ---
function setupUI() {
    // Thêm các div hiển thị máu và lượt vào body hoặc một container khác
    playerHealthDisplay.id = 'player-health';
    enemyHealthDisplay.id = 'enemy-health';
    turnDisplay.id = 'turn-indicator';

    const gameInfoDiv = document.getElementById('game-info'); // Dùng div có sẵn
    gameInfoDiv.appendChild(playerHealthDisplay);
    gameInfoDiv.appendChild(enemyHealthDisplay);
    gameInfoDiv.appendChild(turnDisplay);

     // Style cơ bản cho các div mới (thêm vào CSS nếu muốn đẹp hơn)
    playerHealthDisplay.style.marginLeft = '20px';
    enemyHealthDisplay.style.marginLeft = '20px';
    turnDisplay.style.marginLeft = '20px';
    turnDisplay.style.fontWeight = 'bold';
}

function updateUI() {
    levelDisplay.textContent = currentLevel + 1;
    playerHealthDisplay.textContent = `Player HP: ${tank.health}/${tank.maxHealth}`;
    enemyHealthDisplay.textContent = `Enemy HP: ${enemyTank.health}/${enemyTank.maxHealth}`;

    let turnText = "";
    if (gameState === 'PLAYER_TURN') {
        turnText = "Lượt của Bạn";
        turnDisplay.style.color = tank.color;
    } else if (gameState === 'ENEMY_TURN') {
        turnText = "Lượt của Địch";
        turnDisplay.style.color = enemyTank.color;
    } else if (gameState === 'BULLET_FLYING') {
        turnText = "Đạn đang bay...";
        turnDisplay.style.color = '#555';
    } else if (gameState === 'GAME_OVER') {
        turnText = "Game Over";
         turnDisplay.style.color = '#000';
    } else {
         turnText = "Chuẩn bị...";
         turnDisplay.style.color = '#555';
    }
     turnDisplay.textContent = turnText;
}

function setMessage(msg, isSuccess = false) {
    messageDisplay.textContent = msg;
    // Bỏ class vì giờ màu sắc dựa trên người thắng/thua hoặc loại thông báo
    // messageDisplay.className = isSuccess ? 'target-hit-message' : '';
    messageDisplay.style.color = isSuccess ? 'green' : (gameOver && !isSuccess ? 'red' : '#333'); // Xanh nếu thắng, đỏ nếu thua, đen mặc định
}


// --- Main Game Loop ---
function gameLoop() {
    // 1. Xóa màn hình
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Cập nhật trạng thái (dựa trên gameState)
    if (!gameOver) {
         updatePlayerTank(); // Chỉ update input player khi đến lượt
         updateBullets();    // Luôn update đạn khi đang bay
         // Không cần update enemy tank vì nó chỉ hành động trong enemyAI
    }

    // 3. Vẽ lại mọi thứ
    drawTankObject(tank);
    drawTankObject(enemyTank);
    drawBullets();

    // Vẽ chỉ báo gió (giữ nguyên)
    if (wind !== 0 && !gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const windText = `Gió: ${wind > 0 ? '>>' : '<<'} ${Math.abs(wind * 100).toFixed(0)}`;
        ctx.fillText(windText, canvasWidth / 2, 20);
        ctx.textAlign = 'left'; // Reset text align
    }

    // 4. Lặp lại
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Di chuyển Player
    btnLeft.addEventListener('mousedown', () => { if (gameState === 'PLAYER_TURN') tank.isMovingLeft = true; });
    btnLeft.addEventListener('mouseup', () => { tank.isMovingLeft = false; });
    btnLeft.addEventListener('mouseleave', () => { tank.isMovingLeft = false; });
    btnLeft.addEventListener('touchstart', (e) => { if (gameState === 'PLAYER_TURN') { e.preventDefault(); tank.isMovingLeft = true; } }, { passive: false });
    btnLeft.addEventListener('touchend', () => { tank.isMovingLeft = false; });

    btnRight.addEventListener('mousedown', () => { if (gameState === 'PLAYER_TURN') tank.isMovingRight = true; });
    btnRight.addEventListener('mouseup', () => { tank.isMovingRight = false; });
    btnRight.addEventListener('mouseleave', () => { tank.isMovingRight = false; });
    btnRight.addEventListener('touchstart', (e) => { if (gameState === 'PLAYER_TURN') { e.preventDefault(); tank.isMovingRight = true; } }, { passive: false });
    btnRight.addEventListener('touchend', () => { tank.isMovingRight = false; });

    // Xoay nòng Player
    btnTurretUp.addEventListener('mousedown', () => { if (gameState === 'PLAYER_TURN') tank.isTurretMovingUp = true; });
    btnTurretUp.addEventListener('mouseup', () => { tank.isTurretMovingUp = false; });
    btnTurretUp.addEventListener('mouseleave', () => { tank.isTurretMovingUp = false; });
    btnTurretUp.addEventListener('touchstart', (e) => { if (gameState === 'PLAYER_TURN') { e.preventDefault(); tank.isTurretMovingUp = true; } }, { passive: false });
    btnTurretUp.addEventListener('touchend', () => { tank.isTurretMovingUp = false; });

    btnTurretDown.addEventListener('mousedown', () => { if (gameState === 'PLAYER_TURN') tank.isTurretMovingDown = true; });
    btnTurretDown.addEventListener('mouseup', () => { tank.isTurretMovingDown = false; });
    btnTurretDown.addEventListener('mouseleave', () => { tank.isTurretMovingDown = false; });
    btnTurretDown.addEventListener('touchstart', (e) => { if (gameState === 'PLAYER_TURN') { e.preventDefault(); tank.isTurretMovingDown = true; } }, { passive: false });
    btnTurretDown.addEventListener('touchend', () => { tank.isTurretMovingDown = false; });

    // Bắn (Player)
    btnFire.addEventListener('click', handleFireInput);
    btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); handleFireInput(); }, { passive: false });
}


// --- Initialization ---
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const style = window.getComputedStyle(container);
    const width = parseInt(style.width);
    const height = parseInt(style.height);

    canvas.width = width;
    canvas.height = height;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    // Cập nhật lại Y của cả 2 tank
    tank.y = canvasHeight;
    enemyTank.y = canvasHeight;

    // Tải lại level hiện tại để cập nhật vị trí địch theo kích thước mới
    if (gameState !== 'GAME_OVER') {
        // Lưu máu hiện tại trước khi load lại
        const currentTankHealth = tank.health;
        const currentEnemyHealth = enemyTank.health;
        const currentGameState = gameState; // Lưu state hiện tại

        loadLevel(currentLevel); // Tải lại cấu hình

        // Khôi phục máu và state
        tank.health = currentTankHealth;
        enemyTank.health = currentEnemyHealth;
        gameState = currentGameState; // Đặt lại state (ví dụ đang là lượt player thì vẫn là lượt player)
        updateUI(); // Cập nhật lại UI với máu đã khôi phục
    }
}

window.addEventListener('resize', resizeCanvas);

setupUI(); // Thiết lập các div hiển thị thông tin mới
setupEventListeners(); // Gắn các sự kiện vào nút
resizeCanvas(); // Tính toán kích thước canvas ban đầu và đặt vị trí tank
// loadLevel(currentLevel) sẽ được gọi trong resizeCanvas lần đầu
gameLoop(); // Bắt đầu vòng lặp game
