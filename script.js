// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const btnLeft = document.getElementById('btn-left');       // Giữ lại nút di chuyển
const btnRight = document.getElementById('btn-right');      // Giữ lại nút di chuyển
const angleInput = document.getElementById('angle-input'); // Input góc
const velocityInput = document.getElementById('velocity-input'); // Input lực bắn
const angleVisual = document.getElementById('angle-visual'); // Hiển thị góc
const velocityVisual = document.getElementById('velocity-visual'); // Hiển thị lực
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

// --- Game Constants ---
const gravity = 0.15; // Giữ nguyên hoặc điều chỉnh nhẹ
const enemyFireDelay = 1500; // Tăng nhẹ delay để AI có vẻ "tính toán"
const turnSwitchDelay = 800;
const playerFireCooldown = 500; // Cooldown bắn của player
const MAX_SIMULATION_STEPS = 300; // Giới hạn bước mô phỏng cho AI

// --- Player Tank Definition ---
const tank = {
    id: 'player',
    x: 50,
    y: 0,
    width: 50,
    height: 25,
    color: '#5CB85C',
    speed: 2.5, // Giữ tốc độ di chuyển
    turret: {
        length: 35,
        width: 8,
        angle: -Math.PI / 4, // Góc mặc định (45 độ)
        color: '#4CAF50',
        // angleSpeed không cần nữa
        pivotXOffset: 25,
        pivotYOffset: 0
    },
    health: 100,
    maxHealth: 100,
    isMovingLeft: false, // Giữ lại di chuyển
    isMovingRight: false, // Giữ lại di chuyển
    // isTurretMovingUp/Down không cần nữa
    canFire: true,
};

// --- Enemy Tank Definition (Tăng độ khó) ---
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
        angle: -3 * Math.PI / 4, // Quay về phía player
        color: '#C9302C',
    },
    health: 100,
    maxHealth: 100,
    // aimAccuracyError sẽ được đặt theo level
    // firePowerVariation không cần thiết nếu AI tính toán tốt hơn
    baseDamage: 25, // Tăng sát thương cơ bản của địch
    damageRange: 15, // Sát thương = base + random(0 to range) -> 25-40
};

// --- Level Definitions (Thêm aimError) ---
const levels = [
    // Độ khó tăng dần: máu, gió, độ chính xác AI
    { enemyXRatio: 0.85, enemyHealthMultiplier: 1.0, wind: 0,      aimError: 0.15 }, // Level 1: Dễ
    { enemyXRatio: 0.8,  enemyHealthMultiplier: 1.1, wind: 0.01,   aimError: 0.10 },
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 1.2, wind: -0.015, aimError: 0.07 },
    { enemyXRatio: 0.75, enemyHealthMultiplier: 1.4, wind: 0.025,  aimError: 0.05 },
    { enemyXRatio: 0.8,  enemyHealthMultiplier: 1.7, wind: -0.035, aimError: 0.03 }, // Khó hơn
    { enemyXRatio: 0.9,  enemyHealthMultiplier: 2.2, wind: 0.045,  aimError: 0.02 }, // Rất khó
    { enemyXRatio: 0.7,  enemyHealthMultiplier: 3.0, wind: -0.055, aimError: 0.01 }, // Cực khó
];

// --- Drawing Functions (Không thay đổi nhiều) ---
// drawTankObject, drawBullets giữ nguyên

// --- Update Functions ---
function updatePlayerTank() {
    // Chỉ cho phép player di chuyển khi đến lượt và game chưa kết thúc
    if (gameState !== 'PLAYER_TURN' || gameOver) {
        // Đảm bảo dừng di chuyển nếu không phải lượt player
        tank.isMovingLeft = false;
        tank.isMovingRight = false;
        return;
    }

    // Di chuyển Trái/Phải (Logic giữ nguyên)
    if (tank.isMovingLeft) {
        const nextX = tank.x - tank.speed;
        if (nextX >= 0) { tank.x = nextX; }
    }
    if (tank.isMovingRight) {
        const nextX = tank.x + tank.speed;
        if (nextX <= canvasWidth - tank.width) { tank.x = nextX; }
    }

    // **KHÔNG CẦN CẬP NHẬT GÓC NÒNG Ở ĐÂY NỮA**
    // Góc nòng sẽ được cập nhật trực tiếp từ input
}

function updateBullets() {
    if (bullets.length === 0) {
         if (gameState === 'BULLET_FLYING') { switchTurn(); } // Chuyển lượt nếu hết đạn và đang bay
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

        // Kiểm tra va chạm Player -> Enemy
        if (bullet.owner === 'player' && checkCollision(bullet, enemyTank)) {
            hitTargetTank = enemyTank;
            damage = Math.floor(Math.random() * 11) + 20; // Player damage: 20-30
        }
        // Kiểm tra va chạm Enemy -> Player
        else if (bullet.owner === 'enemy' && checkCollision(bullet, tank)) {
            hitTargetTank = tank;
            // Tăng sát thương địch dựa trên baseDamage và damageRange
            damage = enemyTank.baseDamage + Math.floor(Math.random() * (enemyTank.damageRange + 1));
        }

        if (hitTargetTank) {
            bullets.splice(i, 1);
            dealDamage(hitTargetTank, damage);
            continue;
        }

        // Va chạm đất
        if (bullet.y + bullet.radius > canvasHeight) {
            bullets.splice(i, 1);
            continue;
        }

        // Bay ra ngoài
        if (bullet.x < -100 || bullet.x > canvasWidth + 100 || bullet.y < -canvasHeight) {
            bullets.splice(i, 1);
        }
    }

    // Nếu không còn đạn sau khi cập nhật -> chuyển lượt
    if (bullets.length === 0) {
        switchTurn();
    }
}

// checkCollision, dealDamage giữ nguyên

// --- AI Logic (Cải thiện đáng kể) ---

// Hàm mô phỏng quỹ đạo đạn (không vẽ, chỉ tính toán)
function simulateShot(startX, startY, angleRad, velocity, targetTank) {
    let simX = startX;
    let simY = startY;
    let simVx = Math.cos(angleRad) * velocity;
    let simVy = Math.sin(angleRad) * velocity;
    let steps = 0;

    while (simY <= canvasHeight && steps < MAX_SIMULATION_STEPS) {
        simVy += gravity;
        simVx += wind; // Mô phỏng cả gió
        simX += simVx;
        simY += simVy;

        // Kiểm tra va chạm với mục tiêu trong mô phỏng
        const simBullet = { x: simX, y: simY, radius: 2 }; // Dùng radius nhỏ để check tâm
        if (checkCollision(simBullet, targetTank)) {
            return { hit: true, x: simX, y: simY, steps: steps }; // Trúng đích
        }

        steps++;
    }
    // Nếu không trúng hoặc quá nhiều bước, trả về vị trí cuối cùng
    return { hit: false, x: simX, y: simY, steps: steps };
}


function enemyAI() {
    if (gameState !== 'ENEMY_TURN' || gameOver) return;

    setMessage("Địch đang tính toán...");
    updateUI(); // Cập nhật giao diện ngay

    // Thực hiện tính toán AI trong setTimeout để không block game loop
    setTimeout(() => {
        if (gameState !== 'ENEMY_TURN' || gameOver) return; // Kiểm tra lại state

        const sourceX = enemyTank.x + enemyTank.width / 2;
        const sourceY = enemyTank.y - enemyTank.height / 2;
        const targetX = tank.x + tank.width / 2;
        const targetY = tank.y - tank.height / 2;

        let bestShot = { angle: -Math.PI / 2, power: 10, closestDist: Infinity };

        // Thử nhiều cặp góc/lực bắn khác nhau để tìm cú bắn tốt nhất
        // Có thể tối ưu hóa bước lặp này (ví dụ: binary search hoặc giải thuật thông minh hơn)
        // Hiện tại dùng cách lặp đơn giản
        const angleStep = Math.PI / 180 * 2; // Thử mỗi 2 độ
        const powerStep = 1.5;
        const minPower = 8;
        const maxPower = 24;

        for (let power = minPower; power <= maxPower; power += powerStep) {
            // Góc bắn của địch thường là vòng cầu (-PI -> 0)
            for (let angle = -Math.PI * 0.95; angle < -Math.PI * 0.05; angle += angleStep) {
                const simResult = simulateShot(sourceX, sourceY, angle, power, tank);

                if (simResult.hit) {
                    // Ưu tiên bắn trúng trực tiếp
                    bestShot = { angle: angle, power: power, closestDist: 0, hit: true };
                    // console.log(`AI found DIRECT HIT: Angle=${(angle * 180 / Math.PI).toFixed(1)}, Power=${power.toFixed(1)}`);
                    break; // Thoát vòng lặp góc khi tìm thấy cú bắn trúng
                } else {
                    // Nếu không trúng, tìm cú bắn gần nhất
                    const dx = simResult.x - targetX;
                    const dy = simResult.y - targetY; // Có thể chỉ quan tâm dx nếu muốn bắn qua đầu/chạm đất gần
                    const distSq = dx * dx + dy * dy; // Bình phương khoảng cách

                    if (distSq < bestShot.closestDist) {
                         bestShot = { angle: angle, power: power, closestDist: distSq };
                         // console.log(`AI found closer shot: Angle=${(angle * 180 / Math.PI).toFixed(1)}, Power=${power.toFixed(1)}, DistSq=${distSq.toFixed(0)}`);
                    }
                }
            }
            if (bestShot.hit) break; // Thoát vòng lặp lực nếu đã bắn trúng
        }


        // Sau khi tìm được cú bắn tốt nhất (hoặc gần nhất)
        let finalAngle = bestShot.angle;
        let finalPower = bestShot.power;

        // Thêm sai số dựa trên độ khó của level
        const errorMagnitude = enemyTank.aimAccuracyError * (Math.PI / 4); // Scale sai số
        finalAngle += (Math.random() - 0.5) * 2 * errorMagnitude;
        // Có thể thêm sai số nhỏ cho lực bắn nữa nếu muốn
        // finalPower += (Math.random() - 0.5) * (initialBulletVelocity * 0.1);


        // Giới hạn lại góc sau khi thêm sai số
        const minEnemyAngle = -Math.PI * 0.95;
        const maxEnemyAngle = -Math.PI * 0.05;
        enemyTank.turret.angle = Math.max(minEnemyAngle, Math.min(maxEnemyAngle, finalAngle));

        // Bắn với thông số đã tính toán (có sai số)
        setMessage("Địch bắn!");
        fireBullet(enemyTank, finalPower);

    }, 50); // Delay nhỏ để thực hiện tính toán, tránh lag

}


// --- Game Logic ---
function fireBullet(shooterTank, power) { // power giờ là bắt buộc
    // Tính vị trí đầu nòng
    const pivotX = shooterTank.x + (shooterTank.turret.pivotXOffset !== undefined ? shooterTank.turret.pivotXOffset : shooterTank.width / 2);
    const pivotY = shooterTank.y - shooterTank.height + (shooterTank.turret.pivotYOffset !== undefined ? shooterTank.turret.pivotYOffset : 0);
    const angle = shooterTank.turret.angle; // Lấy góc hiện tại của nòng
    const muzzleX = pivotX + Math.cos(angle) * shooterTank.turret.length;
    const muzzleY = pivotY + Math.sin(angle) * shooterTank.turret.length;

    // Tính vận tốc dựa trên power (vận tốc đầu) và góc
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

    lastShooterId = shooterTank.id;
    gameState = 'BULLET_FLYING';
    updateUI();

    // Xử lý cooldown cho player
    if (shooterTank.id === 'player') {
        tank.canFire = false;
        setTimeout(() => {
            if (gameState === 'PLAYER_TURN' || gameState === 'LEVEL_START') { // Cho phép bắn lại nếu đang đợi lượt hoặc bắt đầu level
                tank.canFire = true;
            }
        }, playerFireCooldown);
    }
}

function handleFireInput() {
    if (gameState === 'PLAYER_TURN' && tank.canFire && !gameOver) {
        const angleDeg = parseFloat(angleInput.value);
        const velocity = parseFloat(velocityInput.value);

        // Validate input
        if (isNaN(angleDeg) || angleDeg < 0 || angleDeg > 90 || isNaN(velocity) || velocity < 1 || velocity > 25) {
            setMessage("Giá trị Góc/Lực không hợp lệ!", false);
            return;
        }

        // Cập nhật góc nòng trực quan của xe tăng
        // Chuyển đổi góc Deg sang Rad và điều chỉnh hệ tọa độ (0 độ là ngang sang phải, canvas y ngược)
        const angleRad = -(angleDeg * Math.PI / 180); // Góc âm vì trục Y ngược
        tank.turret.angle = angleRad;

        setMessage(""); // Xóa thông báo lỗi nếu có
        fireBullet(tank, velocity); // Bắn với lực từ input
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // -- Player Movement Controls --
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

    // -- Physics Input Controls --
    angleInput.addEventListener('input', () => {
        const angleDeg = parseFloat(angleInput.value);
        if (!isNaN(angleDeg) && angleDeg >= 0 && angleDeg <= 90) {
             // Cập nhật góc nòng trực quan ngay lập tức
             const angleRad = -(angleDeg * Math.PI / 180);
             tank.turret.angle = angleRad;
             angleVisual.textContent = `(${angleDeg}°)`; // Cập nhật hiển thị
        } else {
             angleVisual.textContent = `(??°)`;
        }
    });

    velocityInput.addEventListener('input', () => {
         const velocity = parseFloat(velocityInput.value);
        if (!isNaN(velocity) && velocity >= 1 && velocity <= 25) {
            velocityVisual.textContent = `(${velocity.toFixed(1)})`; // Hiển thị 1 chữ số thập phân
        } else {
             velocityVisual.textContent = `(??)`;
        }
    });

    // -- Fire Button --
    btnFire.addEventListener('click', handleFireInput);
    btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); handleFireInput(); }, { passive: false });

    // -- Window Resize --
    window.addEventListener('resize', resizeCanvas);
}


// --- Initialization and Game Loop ---
// Các hàm: switchTurn, handleGameOver, loadLevel, nextLevel, updateUI, setMessage, gameLoop, resizeCanvas
// Gần như giữ nguyên logic cốt lõi từ phiên bản trước, chỉ cần đảm bảo:
// 1. loadLevel đặt đúng aimAccuracyError cho enemyTank từ cấu hình level.
// 2. updateUI hiển thị đúng thông tin.
// 3. resizeCanvas xử lý khôi phục trạng thái đúng cách.

// (Copy các hàm switchTurn, handleGameOver, loadLevel, nextLevel, updateUI, setMessage, gameLoop, resizeCanvas từ phiên bản trước vào đây,
// đảm bảo sửa đổi loadLevel để lấy aimError)

// **Sửa đổi hàm loadLevel để nhận aimError:**
function loadLevel(levelIndex) {
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }
    if (levelIndex >= levels.length) { /* ... (xử lý hết level) ... */ return; }

    const levelData = levels[levelIndex];
    currentLevel = levelIndex;
    gameOver = false;
    gameState = 'LEVEL_START';

    // Reset Player
    tank.health = tank.maxHealth;
    tank.x = 50;
    tank.y = canvasHeight;
    // Đặt lại góc/lực input về giá trị mặc định
    angleInput.value = 45;
    velocityInput.value = 15;
    tank.turret.angle = -(45 * Math.PI / 180); // Góc trực quan ban đầu
    angleVisual.textContent = `(45°)`;
    velocityVisual.textContent = `(15.0)`;
    tank.canFire = true;

    // Setup Enemy
    enemyTank.maxHealth = Math.floor(100 * levelData.enemyHealthMultiplier);
    enemyTank.health = enemyTank.maxHealth;
    enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2;
    enemyTank.y = canvasHeight;
    enemyTank.aimAccuracyError = levelData.aimError; // <-- LẤY aimError TỪ LEVEL CONFIG
    enemyTank.turret.angle = Math.atan2(tank.y - tank.height / 2 - (enemyTank.y - enemyTank.height / 2), tank.x + tank.width/2 - (enemyTank.x + enemyTank.width/2));

    // Đặt gió
    wind = levelData.wind || 0;

    // Reset trạng thái khác
    bullets = [];

    setMessage(`Level ${currentLevel + 1} bắt đầu!`);
    updateUI();

    // Bắt đầu lượt chơi đầu tiên
    setTimeout(() => {
        if (!gameOver && gameState === 'LEVEL_START') {
             gameState = 'PLAYER_TURN';
             lastShooterId = 'enemy';
             setMessage("Lượt của Bạn");
             updateUI();
        }
    }, 1500);
}

// --- Start the game ---
setupEventListeners();
resizeCanvas();
gameLoop();

//*************************************************
// Đảm bảo các hàm sau được copy từ phiên bản trước
// và hoạt động đúng với logic mới:
// - switchTurn()
// - handleGameOver()
// - nextLevel()
// - updateUI()
// - setMessage()
// - gameLoop() // (Đã có ở trên)
// - resizeCanvas() // (Đã có ở trên, cần kiểm tra lại logic khôi phục state)
//*************************************************

// Hàm switchTurn (Copy từ trước, đảm bảo hoạt động)
let switchTurnTimeout = null;
function switchTurn() {
    if (switchTurnTimeout) return;
    if (gameState !== 'BULLET_FLYING' || bullets.length > 0) return;

    switchTurnTimeout = setTimeout(() => {
        switchTurnTimeout = null;
        if (gameOver) return;

        if (enemyTank.health <= 0) { handleGameOver(true); return; }
        if (tank.health <= 0) { handleGameOver(false); return; }

        if (lastShooterId === 'player') {
            gameState = 'ENEMY_TURN';
            setMessage("Lượt của Địch");
            updateUI();
            enemyAI();
        } else {
            gameState = 'PLAYER_TURN';
            tank.canFire = true;
            setMessage("Lượt của Bạn");
            updateUI();
        }
    }, turnSwitchDelay);
}

// Hàm handleGameOver (Copy từ trước, đảm bảo hoạt động)
function handleGameOver(playerWins) {
    if (gameOver) return;
    gameOver = true;
    gameState = 'GAME_OVER';
    setMessage(playerWins ? "CHIẾN THẮNG!" : "THẤT BẠI!", playerWins);
    updateUI();
    if (switchTurnTimeout) { clearTimeout(switchTurnTimeout); switchTurnTimeout = null; }

    if (playerWins) {
        setTimeout(() => {
            if (currentLevel < levels.length - 1) { nextLevel(); }
            else { setMessage("Bạn đã hoàn thành tất cả các màn!", true); }
        }, 2500);
    } else {
        setTimeout(() => { loadLevel(currentLevel); }, 3000);
    }
}

// Hàm nextLevel (Copy từ trước)
function nextLevel() {
    loadLevel(currentLevel + 1);
}

// Hàm updateUI (Copy từ trước, đảm bảo cập nhật các element mới nếu cần)
function updateUI() {
    levelDisplay.textContent = currentLevel + 1;
    playerHealthDisplay.textContent = `Player HP: ${tank.health}/${tank.maxHealth}`;
    enemyHealthDisplay.textContent = `Enemy HP: ${enemyTank.health}/${enemyTank.maxHealth}`;

    let turnText = "";
    let turnColor = "#333";
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
    } else {
        windIndicator.textContent = "";
    }
    // Cập nhật hiển thị input nếu cần (thường không cần vì event 'input' đã làm)
    // angleVisual.textContent = `(${parseFloat(angleInput.value).toFixed(0)}°)`;
    // velocityVisual.textContent = `(${parseFloat(velocityInput.value).toFixed(1)})`;
}

// Hàm setMessage (Copy từ trước, đảm bảo hoạt động)
function setMessage(msg, isSuccess = false) {
    messageDisplay.textContent = msg;
    let msgColor = '#333';
    if (gameState === 'GAME_OVER') { msgColor = isSuccess ? 'green' : 'red'; }
    // Có thể thêm màu cho thông báo bắn trúng...
    messageDisplay.style.color = msgColor;
}


// Hàm resizeCanvas (Cần kiểm tra lại cẩn thận logic khôi phục state)
function resizeCanvas() {
    // Lưu trạng thái
    const currentTankHealth = tank.health;
    const currentEnemyHealth = enemyTank.health;
    const currentGameState = gameState;
    const currentGameOver = gameOver;
    const currentLastShooter = lastShooterId;
    const currentBullets = bullets.map(b => ({ ...b })); // Deep copy đạn
    const currentAngle = angleInput.value;
    const currentVelocity = velocityInput.value;
    const currentTankAngle = tank.turret.angle;


    // Resize canvas
    const container = document.getElementById('game-container');
    const style = window.getComputedStyle(container);
    const width = parseInt(style.width);
    const height = parseInt(style.height);
    canvas.width = width;
    canvas.height = height;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    // Cập nhật Y
    tank.y = canvasHeight;
    enemyTank.y = canvasHeight;

    // Khôi phục hoặc tải lại level
    if (!currentGameOver && currentGameState !== 'LEVEL_START') {
        const levelData = levels[currentLevel];
        enemyTank.x = canvasWidth * levelData.enemyXRatio - enemyTank.width / 2; // Cập nhật X địch

        // Khôi phục trạng thái
        tank.health = currentTankHealth;
        enemyTank.health = currentEnemyHealth;
        gameState = currentGameState;
        gameOver = currentGameOver;
        lastShooterId = currentLastShooter;
        bullets = currentBullets; // Khôi phục đạn
        // Khôi phục input và góc trực quan
        angleInput.value = currentAngle;
        velocityInput.value = currentVelocity;
        tank.turret.angle = currentTankAngle;
        angleVisual.textContent = `(${parseFloat(currentAngle).toFixed(0)}°)`;
        velocityVisual.textContent = `(${parseFloat(currentVelocity).toFixed(1)})`;


        // Cập nhật Y đạn nếu cần
        bullets.forEach(b => { if (b.y > canvasHeight) b.y = canvasHeight - b.radius; });

        updateUI();
    } else {
        // Tải lại level nếu game over hoặc đang bắt đầu
        loadLevel(currentLevel);
    }
}
