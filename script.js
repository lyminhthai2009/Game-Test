const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- KHAI BÁO BIẾN GAME CONSTANTS LÊN ĐẦU ---
let scaleFactor = 1; // Khởi tạo scaleFactor trước
let gravity;
let tankBoost;
let pipeSpeed;
let pipeGap;
let pipeWidth;
let tankBodyWidth;
let tankBodyHeight;
let tankTurretWidth;
let tankTurretHeight;
let turretRotationSpeed;

// --- Cài đặt Responsive ---
function resizeCanvas() {
    const aspectRatio = 9 / 16;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    let canvasHeight = windowHeight * 0.9;
    let canvasWidth = canvasHeight * aspectRatio;
    if (canvasWidth > windowWidth * 0.95) {
        canvasWidth = windowWidth * 0.95;
        canvasHeight = canvasWidth / aspectRatio;
    }
    canvas.width = Math.floor(canvasWidth);
    canvas.height = Math.floor(canvasHeight);
    // Tính toán lại scaleFactor dựa trên kích thước mới
    scaleFactor = canvas.height / 512; // Kích thước gốc tham chiếu
    updateGameConstants(); // <<< Gọi sau khi scaleFactor được cập nhật
}

// --- HÀM CẬP NHẬT HẰNG SỐ ---
// Hàm này chỉ gán giá trị, các biến đã được khai báo ở trên
function updateGameConstants() {
    gravity = 0.3 * scaleFactor; // Giờ đây gravity đã được khai báo
    tankBoost = -6 * scaleFactor;
    pipeSpeed = 2 * scaleFactor;
    pipeGap = 120 * scaleFactor;
    pipeWidth = 60 * scaleFactor;
    tankBodyWidth = 40 * scaleFactor;
    tankBodyHeight = 30 * scaleFactor;
    tankTurretWidth = 30 * scaleFactor;
    tankTurretHeight = 10 * scaleFactor;
    turretRotationSpeed = 0.05;
}

// --- GỌI KHỞI TẠO BAN ĐẦU ---
// Gọi resizeCanvas để tính kích thước và scaleFactor lần đầu
resizeCanvas(); // Hàm này sẽ tự động gọi updateGameConstants bên trong nó

// --- Thêm Event Listeners ---
window.addEventListener('resize', resizeCanvas); // Khi resize, gọi lại resizeCanvas (và updateGameConstants)

// --- Biến Game khác ---
let tank = {
    x: 50 * scaleFactor, // Sử dụng scaleFactor đã được tính ở resizeCanvas
    y: canvas.height / 2 - (tankBodyHeight / 2), // Sử dụng tankBodyHeight đã được tính
    width: tankBodyWidth,
    height: tankBodyHeight,
    velocity: 0,
    turretAngle: 0
};

let pipes = [];
let score = 0;
let frameCount = 0;
let gameState = 'start';
let imagesLoaded = 0; // Sửa lại tên biến nếu cần
// const totalImages = 4; // Hoặc totalAssets

// --- Tải hình ảnh ---
const tankBodyImg = new Image();
const tankTurretImg = new Image();
const pipeTopImg = new Image();
const pipeBottomImg = new Image();

let loadCounter = 0;
const totalAssets = 4;

function assetLoaded() {
    loadCounter++;
    if (loadCounter === totalAssets) {
        console.log("Tất cả hình ảnh đã tải xong!");
        // Quan trọng: Có thể cần gọi lại resizeCanvas/updateGameConstants ở đây
        // nếu kích thước ảnh ảnh hưởng đến tính toán ban đầu.
        // Hoặc đảm bảo các giá trị ban đầu của tank dựa trên scaleFactor đã tính là đủ tốt.
        // resizeCanvas(); // Gọi lại để chắc chắn mọi thứ được cập nhật sau khi có kích thước ảnh (nếu cần)
        resetGame(); // Reset trạng thái game về ban đầu trước khi loop
        gameState = 'start'; // Đặt trạng thái bắt đầu
        gameLoop(); // Bắt đầu vòng lặp game
    }
}

tankBodyImg.onload = assetLoaded;
tankTurretImg.onload = assetLoaded;
pipeTopImg.onload = assetLoaded;
pipeBottomImg.onload = assetLoaded;

tankBodyImg.src = 'assets/tank-body.png';
tankTurretImg.src = 'assets/tank-turret.png';
pipeTopImg.src = 'assets/pipe-top.png';
pipeBottomImg.src = 'assets/pipe-bottom.png';

// --- Các hàm Vẽ (drawTank, drawPipes, drawScore, ...) ---
// ... (Giữ nguyên các hàm vẽ) ...
function drawTank() {
    // --- Vẽ Thân Xe Tăng ---
    // Đảm bảo tankBodyWidth và tankBodyHeight đã được tính toán trong updateGameConstants
    ctx.drawImage(tankBodyImg, tank.x, tank.y, tankBodyWidth, tankBodyHeight); // Sử dụng biến đã tính

    // --- Vẽ Nòng Pháo Quay ---
    ctx.save();
    const pivotX = tank.x + tankBodyWidth / 2; // Sử dụng biến đã tính
    const pivotY = tank.y + tankBodyHeight / 2; // Sử dụng biến đã tính
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tank.turretAngle);
    ctx.drawImage(
        tankTurretImg,
        0,
        -tankTurretHeight / 2, // Sử dụng biến đã tính
        tankTurretWidth,       // Sử dụng biến đã tính
        tankTurretHeight       // Sử dụng biến đã tính
    );
    ctx.restore();
}
function drawPipes() {
    pipes.forEach(pipe => {
        ctx.drawImage(pipeTopImg, pipe.x, pipe.topPipe.y, pipe.width, pipe.topPipe.height);
        ctx.drawImage(pipeBottomImg, pipe.x, pipe.bottomPipe.y, pipe.width, pipe.bottomPipe.height);
    });
}
function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = `${Math.floor(30 * scaleFactor)}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1 * scaleFactor;
    ctx.strokeText(score, canvas.width / 2, 50 * scaleFactor);
    ctx.fillText(score, canvas.width / 2, 50 * scaleFactor);
}
function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = `${Math.floor(25 * scaleFactor)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Nhấn để Bắt đầu', canvas.width / 2, canvas.height / 2);
}
function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'red';
    ctx.font = `${Math.floor(30 * scaleFactor)}px Arial BOLD`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER!', canvas.width / 2, canvas.height / 2 - 40 * scaleFactor);
    ctx.fillStyle = 'white';
    ctx.font = `${Math.floor(20 * scaleFactor)}px Arial`;
    ctx.fillText(`Điểm: ${score}`, canvas.width / 2, canvas.height / 2);
    ctx.fillText('Nhấn để Chơi lại', canvas.width / 2, canvas.height / 2 + 40 * scaleFactor);
}

// --- Các hàm Cập nhật (updateTank, updatePipes, ...) ---
// ... (Giữ nguyên các hàm cập nhật) ...
function updateTank() {
    tank.velocity += gravity; // gravity đã có giá trị
    tank.y += tank.velocity;
    tank.turretAngle += turretRotationSpeed; // turretRotationSpeed đã có giá trị

    if (tank.y < 0) {
        tank.y = 0;
        tank.velocity = 0;
    }
    if (tank.y + tankBodyHeight > canvas.height) { // Sử dụng tankBodyHeight đã có giá trị
        tank.y = canvas.height - tankBodyHeight;
        tank.velocity = 0;
        gameState = 'gameOver';
    }
}
function createPipe() {
    const topPipeHeight = Math.random() * (canvas.height / 2 - pipeGap / 2) + 50 * scaleFactor;
    const bottomPipeY = topPipeHeight + pipeGap; // pipeGap đã có giá trị
    const bottomPipeHeight = canvas.height - bottomPipeY;
    pipes.push({
        x: canvas.width,
        width: pipeWidth, // pipeWidth đã có giá trị
        scored: false,
        topPipe: { y: 0, height: topPipeHeight },
        bottomPipe: { y: bottomPipeY, height: bottomPipeHeight }
    });
}
function updatePipes() {
    if (frameCount % 120 === 0) {
        createPipe();
    }
    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed; // pipeSpeed đã có giá trị

        const tankRight = tank.x + tankBodyWidth; // Sử dụng biến đã có giá trị
        const tankBottom = tank.y + tankBodyHeight; // Sử dụng biến đã có giá trị
        const pipeRight = pipe.x + pipe.width;

        if (
            tankRight > pipe.x &&
            tank.x < pipeRight &&
            (tank.y < pipe.topPipe.height ||
             tankBottom > pipe.bottomPipe.y)
           )
        {
            gameState = 'gameOver';
        }

        if (!pipe.scored && tank.x > pipe.x + pipe.width / 2) {
            score++;
            pipe.scored = true;
        }
    });
    pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);
}


// --- Xử lý Input ---
// ... (Giữ nguyên hàm handleInput) ...
function handleInput() {
    if (gameState === 'playing') {
        tank.velocity = tankBoost; // tankBoost đã có giá trị
    } else if (gameState === 'start' || gameState === 'gameOver') {
        resetGame();
        gameState = 'playing';
    }
}

// --- Reset Game ---
// ... (Giữ nguyên hàm resetGame) ...
function resetGame() {
    // Cần đảm bảo tankBodyHeight và các hằng số khác đã được tính toán
    // thông qua resizeCanvas -> updateGameConstants trước khi reset
    tank.y = canvas.height / 2 - (tankBodyHeight / 2);
    tank.velocity = 0;
    tank.turretAngle = 0;
    pipes = [];
    score = 0;
    frameCount = 0;
}


// --- Vòng lặp Game ---
// ... (Giữ nguyên hàm gameLoop) ...
function gameLoop(currentTime) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'playing') {
        updateTank();
        updatePipes();
        frameCount++;
        drawPipes();
        drawTank();
        drawScore();
    } else if (gameState === 'start') {
        // Vẽ trạng thái chờ, đảm bảo các biến vẽ đã được khởi tạo
        drawTank(); // Vẽ tank ở vị trí chờ
        // drawPipes(); // Có thể vẽ ống tĩnh nếu muốn
        drawStartScreen();
    } else if (gameState === 'gameOver') {
        drawPipes();
        drawTank();
        drawGameOverScreen();
    }

    requestAnimationFrame(gameLoop);
}

// --- Bắt đầu Game ---
// assetLoaded() sẽ gọi gameLoop() sau khi ảnh tải xong
console.log("Đang tải hình ảnh...");

// --- Listener cho Input (đặt ở cuối cùng cũng được) ---
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    handleInput();
});
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        handleInput();
    }
});
