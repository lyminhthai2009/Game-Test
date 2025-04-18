// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnTurretUp = document.getElementById('btn-turret-up');
const btnTurretDown = document.getElementById('btn-turret-down');
const btnFire = document.getElementById('btn-fire');
const levelDisplay = document.getElementById('level-display');
const playerHealthDisplay = document.getElementById('player-health');
const enemyHealthDisplay = document.getElementById('enemy-health');
const turnDisplay = document.getElementById('turn-indicator');
const messageDisplay = document.getElementById('message-display');
const windIndicator = document.getElementById('wind-indicator'); // Lấy thẻ div gió

// --- Game State ---
let canvasWidth, canvasHeight;
let currentLevel = 0;
let bullets = [];
let wind = 0;
let gameOver = false;
let gameState = 'LEVEL_START'; // PLAYER_TURN, ENEMY_TURN, BULLET_FLYING, GAME_OVER, LEVEL_START
let lastShooterId = 'enemy'; // Người bắn cuối cùng, dùng để quyết định lượt tiếp theo

// --- Game Constants ---
const gravity = 0.15;
const initialBulletVelocity = 12; // Hơi tăng vận tốc đạn
const enemyFireDelay = 1200; // Thời gian địch chờ (ms)
const turnSwitchDelay = 800; // Thời gian chờ chuyển lượt (ms)
const playerFireCooldown = 400; // Cooldown bắn của player (ms)

// --- Player Tank Definition ---
const tank = {
    id: 'player',
    x: 50,
    y: 0,
    width: 50,
    height: 25,
    color: '#5CB85C', // Player màu xanh lá
    speed: 2.5,
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
    canFire: true, // Trạng thái có thể bắn (quản lý bởi cooldown)
};

// --- Enemy Tank Definition ---
const enemyTank = {
    id: 'enemy',
    x: 0,
    y: 0,
    width: 50,
    height: 25,
    color: '#D9534F', // Enemy màu đỏ cam
    turret: {
        length: 35,
        width: 8,
        angle: -5 * Math.PI / 6,
        color: '#C9302C',
    },
    health: 100,
    maxHealth: 100,
    aimAccuracyError: 0.08, // Giảm sai số một chút
    firePowerVariation: 0.15 // Tăng độ biến thiên lực bắn
};

// --- Level Definitions ---
const levels = [
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.0, wind: 0 },
    { enemyXRatio: 0.8, enemyHealthMultiplier: 1.1, wind: 0.01 },
    { enemyXRatio: 0.9, enemyHealthMultiplier: 1.2, wind: -0.015 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 1.4, wind: 0.025 }, // Tăng gió chút
    { enemyXRatio: 0.8, enemyHealthMultiplier: 1.6, wind: -0.035 }, // Tăng gió chút
    { enemyXRatio: 0.9, enemyHealthMultiplier: 2.0, wind: 0.04 },
    { enemyXRatio: 0.7, enemyHealthMultiplier: 2.5, wind: -0.05 }, // Level khó hơn
];

// --- Drawing Functions ---
function drawTankObject(tankObj) {
    // Thân xe
    ctx.fillStyle = tankObj.color;
    ctx.fillRect(tankObj.x, tankObj.y - tankObj.height, tankObj.width, tankObj.height);

    // Nòng súng (Đảm bảo dùng đúng offset nếu có)
    ctx.save();
    const pivotX = tankObj.x + (tankObj.turret.pivotXOffset !== undefined ? tankObj.turret.pivotXOffset : tankObj.width / 2);
    const pivotY = tankObj.y - tankObj.height + (tankObj.turret.pivotYOffset !== undefined ? tankObj.turret.pivotYOffset : 0);
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tankObj.turret.angle);
    ctx.fillStyle = tankObj.turret.color;
    ctx.fillRect(0, -tankObj.turret.width / 2, tankObj.turret.length, tankObj.turret.width);
    ctx.restore();

    // Thanh máu (vẽ đè lên trên cùng)
    const healthBarWidth = tankObj.width;
    const healthBarHeight = 5;
    const healthBarX = tankObj.x;
    const healthBarY = tankObj.y - tankObj.height - healthBarHeight - 3;
    const currentHealthWidth = Math.max(0, (tankObj.health / tankObj.maxHealth) * healthBarWidth); // Đảm bảo không âm

    ctx.fillStyle = '#ddd'; // Nền thanh máu
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    ctx.fillStyle = tankObj.health > (tankObj.maxHealth * 0.3) ? '#4CAF50' : '#f44336'; // Đổi màu khi máu thấp
    ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.fillStyle = bullet.owner === 'player' ? '#000000' : '#8B0000'; // Đạn player đen, địch đỏ sẫm
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

// --- Update Functions ---
function updatePlayerTank() {
    // Chỉ cho phép player điều khiển khi đến lượt và game chưa kết thúc
    if (gameState !== 'PLAYER_TURN' || gameOver) return;

    // Di chuyển (Kiểm tra biên giới cẩn thận)
    if (tank.isMovingLeft) {
        const nextX = tank.x - tank.speed;
        if (nextX >= 0) { tank.x = nextX; } // Đảm bảo không đi ra ngoài bên trái
    }
    if (tank.isMovingRight) {
        const nextX = tank.x + tank.speed;
        if (nextX <= canvasWidth - tank.width) { tank.x = nextX; } // Đảm bảo không đi ra ngoài bên phải
    }

    // Xoay nòng (Giới hạn góc hợp lý hơn)
    const minAngle = -Math.PI * 0.85; // Hơi giới hạn quay ra sau
    const maxAngle = Math.PI * 0.1;   // Hơi cho phép chúc xuống
    if (tank.isTurretMovingUp && tank.turret.angle > minAngle) {
        tank.turret.angle -= tank.turret.angleSpeed;
    }
    if (tank.isTurretMovingDown && tank.turret.angle < maxAngle) {
        tank.turret.angle += tank.turret.angleSpeed;
    }
    // Đảm bảo góc luôn trong giới hạn sau khi thay đổi
    tank.turret.angle = Math.max(minAngle, Math.min(maxAngle, tank.turret.angle));
}

function updateBullets() {
    // Chỉ cập nhật khi có đạn và đang trong trạng thái đạn bay
    if (bullets.length === 0 || gameState !== 'BULLET_FLYING') {
        // Nếu hết đạn và đang ở trạng thái BULLET_FLYING -> gọi switchTurn (sẽ có delay)
        if (gameState === 'BULLET_FLYING') {
            switchTurn();
        }
        return;
    }


    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // Áp dụng vật lý
        bullet.vy += gravity;
        bullet.vx += wind; // Gió ảnh hưởng vận tốc ngang
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        let hitTargetTank = null;
        let damage = 0;

        // Kiểm tra va chạm với xe tăng đối phương
        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) {
            hitTargetTank = enemyTank;
            damage = Math.floor(Math.random() * 11) + 20; // Sát thương 20-30
        } else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) {
            hitTargetTank = tank;
            damage = Math.floor(Math.random() * 11) + 15; // Sát thương địch 15-25
        }

        // Nếu bắn trúng xe tăng
        if (hitTargetTank) {
            bullets.splice(i, 1); // Xóa viên đạn
            dealDamage(hitTargetTank, damage);
            // Không chuyển lượt ngay, chờ các viên đạn khác (nếu có) hoặc chạm đất
            continue; // Xử lý viên đạn tiếp theo
        }

        // Kiểm tra va chạm với mặt đất
        if (bullet.y + bullet.radius > canvasHeight) {
            bullets.splice(i, 1); // Xóa viên đạn
            // Có thể thêm hiệu ứng nổ đất nhỏ ở đây
            continue;
        }

        // Xóa đạn nếu bay ra khỏi màn hình quá xa
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) {
            bullets.splice(i, 1);
        }
    }

    // Sau khi kiểm tra hết đạn, nếu không còn viên nào -> gọi switchTurn
    if (bullets.length === 0) {
        switchTurn();
    }
}

function checkCollision(bullet, targetTank) {
    // AABB collision detection
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
    setMessage(`${targetTank.id === 'player' ? 'Bạn' : 'Địch'} trúng đạn! (-${amount} HP)`, false);

    if (targetTank.health <= 0) {
        targetTank.health = 0; // Không để máu âm
        // Không gọi handleGameOver ngay lập tức, chờ switchTurn kiểm tra cuối lượt
    }
    updateUI(); // Cập nhật thanh máu ngay
}

// --- AI Logic ---
function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver) return;

    // 1. Tính toán góc bắn cơ bản đến tâm người chơi
    const sourceX = enemyTank.x + enemyTank.width / 2;
    const sourceY = enemyTank.y - enemyTank.height / 2; // Tâm xe địch
    const targetX = tank.x + tank.width / 2;
    const targetY = tank.y - tank.height / 2; // Tâm xe người chơi

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    let baseAngle = Math.atan2(dy, dx);

    // 2. Ước lượng lực bắn và điều chỉnh góc dựa trên khoảng cách (công thức đơn giản)
    // Công thức này cần tinh chỉnh nhiều để chính xác!
    const distance = Math.sqrt(dx * dx + dy * dy);
    const gravityEffectFactor = 0.001; // Hệ số ảnh hưởng trọng lực (tùy chỉnh)
    const windEffectFactor = 0.005; // Hệ số ảnh hưởng gió (tùy chỉnh)

    // Lực bắn hơi thay đổi dựa trên khoảng cách và sai số
    let firePower = initialBulletVelocity * (1 + (Math.random() - 0.5) * 2 * enemyTank.firePowerVariation);
    firePower *= Math.min(1.5, Math.max(0.8, distance / 300)); // Điều chỉnh lực theo khoảng cách (giới hạn)


    // Điều chỉnh góc thô sơ theo trọng lực và gió
    let adjustedAngle = baseAngle - (distance * gravity * gravityEffectFactor) - (wind * distance * windEffectFactor) ;

    // Thêm sai số ngẫu nhiên cuối cùng
    adjustedAngle += (Math.random() - 0.5) * 2 * enemyTank.aimAccuracyError;


    // Giới hạn góc bắn của địch
    const minEnemyAngle = -Math.PI * 0.9;
    const maxEnemyAngle = -Math.PI * 0.1; // Địch thường bắn vòng cầu
    enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, adjustedAngle));

    // 3. Bắn sau độ trễ
    setMessage("Địch đang ngắm..."); // Thông báo địch đang tính toán
    setTimeout(() => {
        // Kiểm tra lại trạng thái trước khi bắn, phòng khi người chơi thắng trong lúc chờ
        if (gameState === 'ENEMY_TURN' && !gameOver) {
             setMessage("Địch bắn!");
             fireBullet(enemyTank, firePower);
        }
    }, enemyFireDelay);
}


// --- Game Logic ---
function fireBullet(shooterTank, power = initialBulletVelocity) {
    // Tính vị trí đầu nòng chính xác hơn
    const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset !== undefined ? shooterTank.turret.pivotXOffset : shooterTank.width / 2);
    const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset !== undefined ? shooterTank.turret.pivotYOffset : 0);
    const angle = shooterTank.turret.angle; // Lấy góc hiện tại của nòng
    const muzzleX = pivotX + Math.cos(angle) * shooterTank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * shooterTank.turret.length;

    const vx = Math.cos(angle) * power;
    const vy = Math.sin(angle) * power;

    bullets.push({
        owner: shooterTank.id,
        x: muzzleX,
        y: muzzleY,
        vx: vx,
        vy: vy,
        radius: 4
    });

    lastShooterId = shooterTank.id; // QUAN TRỌNG: Lưu lại ai vừa bắn
    gameState = 'BULLET_FLYING'; // Chuyển sang trạng thái đạn bay
    // setMessage(""); // Không xóa message ngay, để người chơi thấy "Địch bắn!"
    updateUI();

    // Xử lý cooldown cho player
    if (shooterTank.id === 'player') {
        tank.canFire = false;
        setTimeout(() => {
            // Chỉ bật lại nếu vẫn đang là lượt player (tránh trường hợp game over trong lúc cooldown)
            if (gameState === 'PLAYER_TURN') {
                tank.canFire = true;
            }
        }, playerFireCooldown);
    }
}

function handleFireInput() {
    // Cho phép bắn chỉ khi đến lượt player, có thể bắn và game chưa kết thúc
    if (gameState === 'PLAYER_TURN' && tank.canFire && !gameOver) {
        setMessage(""); // Xóa thông báo cũ khi player bắn
        fireBullet(tank);
    }
}

let switchTurnTimeout = null; // Biến để lưu timeout, tránh gọi chồng chéo

function switchTurn() {
    // Nếu đã có timeout đang chờ thì không làm gì cả
    if (switchTurnTimeout) {
        // console.log("Switch turn already pending");
        return;
    }
     // Chỉ chuyển lượt nếu đang ở trạng thái BULLET_FLYING và không còn đạn
     if(gameState !== 'BULLET_FLYING' || bullets.length > 0) {
        // console.log("Cannot switch turn, state:", gameState, "bullets:", bullets.length);
        return;
     }


    // console.log("Scheduling switch turn...");
    // Đặt timeout để chuyển lượt
    switchTurnTimeout = setTimeout(() => {
        // console.log("Executing switch turn after delay");
        switchTurnTimeout = null; // Xóa timeout ID khi nó thực thi

        // Kiểm tra lại lần nữa phòng trường hợp game đã kết thúc trong lúc chờ delay
        if (gameOver) {
             // console.log("Game over during switch turn delay");
             return;
        }

        // Kiểm tra máu trước khi chuyển lượt
        if (enemyTank.health <= 0) {
            handleGameOver(true); // Player thắng
            return;
        }
        if (tank.health <= 0) {
            handleGameOver(false); // Player thua
            return;
        }

        // Chuyển lượt dựa trên người bắn cuối cùng
        if (lastShooterId === 'player') {
            gameState = 'ENEMY_TURN';
            setMessage("Lượt của Địch");
            updateUI();
            enemyAI(); // Gọi AI địch
        } else { // lastShooterId === 'enemy'
            gameState = 'PLAYER_TURN';
            tank.canFire = true; // Đảm bảo player có thể bắn khi đến lượt
            setMessage("Lượt của Bạn");
            updateUI();
        }
    }, turnSwitchDelay);
}


function handleGameOver(playerWins) {
    // Đảm bảo chỉ gọi một lần
    if (gameOver) return;

    gameOver = true;
    gameState = 'GAME_OVER';
    setMessage(playerWins ? "CHIẾN THẮNG!" : "THẤT BẠI!", playerWins);
    updateUI(); // Cập nhật UI lần cuối

    // Xóa timeout chuyển lượt nếu có
    if (switchTurnTimeout) {
        clearTimeout(switchTurnTimeout);
        switchTurnTimeout = null;
    }


    if (playerWins) {
        // Tự động qua màn sau N giây
        setTimeout(() => {
            if (currentLevel < levels.length - 1) {
                 nextLevel();
            } else {
                 setMessage("Bạn đã hoàn thành tất cả các màn!", true);
                 // Có thể thêm nút chơi lại toàn bộ
            }
        }, 2500); // Chờ 2.5 giây trước khi qua màn
    } else {
        // Có thể thêm nút "Chơi lại màn này"
         setTimeout(() => {
            // Tải lại level hiện tại để chơi lại
            loadLevel(currentLevel);
        }, 3000); // Chờ 3 giây trước khi chơi lại
    }
}

function loadLevel(levelIndex) {
     // Xóa timeout chuyển lượt cũ (nếu có) khi tải level mới
    if (switchTurnTimeout) {
        clearTimeout(switchTurnTimeout);
        switchTurnTimeout = null;
    }


    if (levelIndex >= levels.length) {
        setMessage("Tuyệt vời! Bạn đã hoàn thành tất cả các màn!", true);
        gameOver = true;
        gameState = 'GAME_OVER';
        updateUI();
        return;
    }

    const levelData = levels[levelIndex];
    currentLevel = levelIndex;
    gameOver = false; // Reset game over flag
    gameState = 'LEVEL_START'; // Trạng thái bắt đầu level

    // Reset Player
    tank.health = tank.maxHealth;
    tank.x = 50; // Vị trí cố định ban đầu
    tank.y = canvasHeight; // Cập nhật Y theo canvas
    tank.turret.angle = -Math.PI / 6;
    tank.canFire = true; // Player luôn có thể bắn khi bắt đầu lượt

    // Setup Enemy
    enemyTank.maxHealth = Math.floor(100 * levelData.enemyHealthMultiplier); // Làm tròn máu tối đa
    enemyTank.health = enemyTank.maxHealth;
    enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2; // Tính toán vị trí X
    enemyTank.y = canvasHeight; // Cập nhật Y
    // Ngắm sơ bộ về phía player khi bắt đầu level
    enemyTank.turret.angle = Math.atan2(tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2), tank.x + tank.width/2 - (enemyTank.x + enemyTank.width/2));

    // Đặt gió
    wind = levelData.wind || 0;

    // Reset trạng thái khác
    bullets = []; // Xóa đạn cũ

    setMessage(`Level ${currentLevel + 1} bắt đầu!`);
    updateUI(); // Cập nhật giao diện (máu, level, gió)

    // Bắt đầu lượt chơi đầu tiên (Player đi trước) sau một chút delay
    setTimeout(() => {
        // Chỉ bắt đầu nếu game chưa kết thúc (ví dụ người chơi resize màn hình nhanh)
        if (!gameOver && gameState === 'LEVEL_START') {
             gameState = 'PLAYER_TURN';
             lastShooterId = 'enemy'; // Để lượt sau là của địch
             setMessage("Lượt của Bạn");
             updateUI();
        }
    }, 1500); // Chờ 1.5 giây trước khi bắt đầu lượt đầu
}

function nextLevel() {
    loadLevel(currentLevel + 1);
}

// --- UI Update Functions ---
function updateUI() {
    // Cập nhật text hiển thị
    levelDisplay.textContent = currentLevel + 1;
    playerHealthDisplay.textContent = `Player HP: ${tank.health}/${tank.maxHealth}`;
    enemyHealthDisplay.textContent = `Enemy HP: ${enemyTank.health}/${enemyTank.maxHealth}`;

    // Cập nhật chỉ báo lượt
    let turnText = "";
    let turnColor = "#333"; // Màu mặc định
    switch (gameState) {
        case 'PLAYER_TURN':
            turnText = "Lượt của Bạn";
            turnColor = tank.color;
            break;
        case 'ENEMY_TURN':
            turnText = "Lượt của Địch";
            turnColor = enemyTank.color;
            break;
        case 'BULLET_FLYING':
            turnText = "Đạn đang bay...";
            turnColor = '#555';
            break;
        case 'GAME_OVER':
            turnText = "Game Over";
            turnColor = '#000';
            break;
        case 'LEVEL_START':
            turnText = "Chuẩn bị...";
            turnColor = '#555';
            break;
    }
    turnDisplay.textContent = turnText;
    turnDisplay.style.color = turnColor;

     // Cập nhật chỉ báo gió
    if (wind !== 0 && !gameOver) {
        windIndicator.textContent = `Gió: ${wind > 0 ? '>>' : '<<'} ${Math.abs(wind * 100).toFixed(0)}`;
    } else {
         windIndicator.textContent = ""; // Không hiển thị gió nếu = 0 hoặc game over
    }

    // Cập nhật màu message dựa trên thành công/thất bại khi game over
     if (gameState === 'GAME_OVER') {
         // Logic màu đã được xử lý trong handleGameOver thông qua setMessage
     }
}

function setMessage(msg, isSuccess = false) {
    messageDisplay.textContent = msg;
    let msgColor = '#333'; // Màu thông báo mặc định
    if (gameState === 'GAME_OVER') {
        msgColor = isSuccess ? 'green' : 'red';
    } else if (gameState === 'ENEMY_TURN' || lastShooterId === 'enemy' && msg.includes('trúng đạn')) {
         msgColor = enemyTank.color; // Thông báo liên quan đến địch màu đỏ
    } else if (gameState === 'PLAYER_TURN' || lastShooterId === 'player' && msg.includes('trúng đạn')) {
        msgColor = tank.color; // Thông báo liên quan đến player màu xanh
    }
     messageDisplay.style.color = msgColor;
}


// --- Main Game Loop ---
function gameLoop() {
    // 1. Xóa màn hình
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Cập nhật trạng thái (chỉ khi game chưa kết thúc)
    if (!gameOver) {
         updatePlayerTank(); // Xử lý input di chuyển/xoay nòng của player
         updateBullets();    // Cập nhật vị trí và va chạm của đạn
    }

    // 3. Vẽ lại mọi thứ
    drawTankObject(tank);    // Vẽ xe tăng người chơi
    drawTankObject(enemyTank); // Vẽ xe tăng địch
    drawBullets();           // Vẽ đạn

    // 4. Lặp lại cho khung hình tiếp theo
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // -- Player Controls --
    // Chỉ cho phép kích hoạt trạng thái nếu đúng lượt
    const handleMoveStart = (key) => { if (gameState === 'PLAYER_TURN' && !gameOver) tank[key] = true; };
    const handleMoveEnd = (key) => { tank[key] = false; }; // Luôn cho phép nhả ra

    // Di chuyển Trái
    btnLeft.addEventListener('mousedown', () => handleMoveStart('isMovingLeft'));
    btnLeft.addEventListener('mouseup', () => handleMoveEnd('isMovingLeft'));
    btnLeft.addEventListener('mouseleave', () => handleMoveEnd('isMovingLeft'));
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isMovingLeft'); }, { passive: false });
    btnLeft.addEventListener('touchend', () => handleMoveEnd('isMovingLeft'));

    // Di chuyển Phải
    btnRight.addEventListener('mousedown', () => handleMoveStart('isMovingRight'));
    btnRight.addEventListener('mouseup', () => handleMoveEnd('isMovingRight'));
    btnRight.addEventListener('mouseleave', () => handleMoveEnd('isMovingRight'));
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isMovingRight'); }, { passive: false });
    btnRight.addEventListener('touchend', () => handleMoveEnd('isMovingRight'));

    // Nâng Nòng
    btnTurretUp.addEventListener('mousedown', () => handleMoveStart('isTurretMovingUp'));
    btnTurretUp.addEventListener('mouseup', () => handleMoveEnd('isTurretMovingUp'));
    btnTurretUp.addEventListener('mouseleave', () => handleMoveEnd('isTurretMovingUp'));
    btnTurretUp.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isTurretMovingUp'); }, { passive: false });
    btnTurretUp.addEventListener('touchend', () => handleMoveEnd('isTurretMovingUp'));

    // Hạ Nòng
    btnTurretDown.addEventListener('mousedown', () => handleMoveStart('isTurretMovingDown'));
    btnTurretDown.addEventListener('mouseup', () => handleMoveEnd('isTurretMovingDown'));
    btnTurretDown.addEventListener('mouseleave', () => handleMoveEnd('isTurretMovingDown'));
    btnTurretDown.addEventListener('touchstart', (e) => { e.preventDefault(); handleMoveStart('isTurretMovingDown'); }, { passive: false });
    btnTurretDown.addEventListener('touchend', () => handleMoveEnd('isTurretMovingDown'));

    // Bắn
    btnFire.addEventListener('click', handleFireInput);
    btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); handleFireInput(); }, { passive: false });

    // Resize Window
    window.addEventListener('resize', resizeCanvas);
}


// --- Initialization ---
function resizeCanvas() {
    // Lưu trạng thái hiện tại trước khi resize
    const currentTankHealth = tank.health;
    const currentEnemyHealth = enemyTank.health;
    const currentGameState = gameState;
    const currentGameOver = gameOver;
    const currentLastShooter = lastShooterId;
    const currentBullets = [...bullets]; // Sao chép mảng đạn

    // Lấy kích thước container
    const container = document.getElementById('game-container');
    const style = window.getComputedStyle(container);
    const width = parseInt(style.width);
    const height = parseInt(style.height);

    // Đặt kích thước canvas
    canvas.width = width;
    canvas.height = height;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    // Cập nhật Y cho tanks
    tank.y = canvasHeight;
    enemyTank.y = canvasHeight;

    // Nếu game đang diễn ra, tải lại level để cập nhật vị trí X của địch
    // nhưng khôi phục lại trạng thái máu, lượt chơi, đạn...
    if (!currentGameOver && currentGameState !== 'LEVEL_START') {
        const levelData = levels[currentLevel]; // Lấy dữ liệu level hiện tại
        // Cập nhật lại vị trí X của địch dựa trên kích thước mới
        enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;

        // Khôi phục trạng thái
        tank.health = currentTankHealth;
        enemyTank.health = currentEnemyHealth;
        gameState = currentGameState;
        gameOver = currentGameOver; // Thường là false ở đây
        lastShooterId = currentLastShooter;
        bullets = currentBullets; // Khôi phục đạn đang bay

        // Cập nhật lại vị trí Y của đạn nếu cần (hiếm khi cần thiết)
        bullets.forEach(b => {
             if (b.y > canvasHeight) b.y = canvasHeight - b.radius; // Điều chỉnh nếu bị đẩy xuống dưới
        });

        updateUI(); // Cập nhật UI với trạng thái đã khôi phục

         // Nếu đang là lượt địch và địch đang chờ bắn, gọi lại AI
         if (gameState === 'ENEMY_TURN') {
             // Có thể cần xóa timeout cũ của AI nếu có và gọi lại
         }

    } else {
        // Nếu đang ở màn hình game over hoặc bắt đầu level, chỉ cần load lại level
        loadLevel(currentLevel);
    }
}

// --- Start the game ---
setupEventListeners(); // Gắn các sự kiện
resizeCanvas();      // Thiết lập kích thước canvas ban đầu và gọi loadLevel(0) bên trong nó lần đầu
gameLoop();          // Bắt đầu vòng lặp chính của game
