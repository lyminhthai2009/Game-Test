const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SETTINGS & CONSTANTS ---
const BASE_WIDTH = 288; // Kích thước gốc để tính scale
const BASE_HEIGHT = 512;
let scaleFactor = 1;

// Object chứa cài đặt cho từng độ khó
const difficultySettings = {
    easy: {
        pipeSpeedFactor: 1.5,
        pipeGapFactor: 140, // Khoảng cách lớn hơn
        pipeFrequency: 220, // Xuất hiện thưa hơn
        gravityFactor: 0.10,
        boostFactor: -4.2
    },
    medium: {
        pipeSpeedFactor: 1.8, // Tốc độ mặc định
        pipeGapFactor: 130,
        pipeFrequency: 180, // Tần suất mặc định
        gravityFactor: 0.25,
        boostFactor: -5.5
    },
    hard: {
        pipeSpeedFactor: 2.2, // Nhanh hơn
        pipeGapFactor: 120, // Hẹp hơn
        pipeFrequency: 150, // Xuất hiện dày hơn
        gravityFactor: 0.28,
        boostFactor: -6.0
    }
};

// Biến lưu trạng thái và cài đặt game hiện tại
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let currentDifficulty = 'medium'; // Mặc định
let score = 0;
let highScore = 0;

// Biến sẽ được cập nhật dựa trên độ khó và scaleFactor
let gravity;
let tankBoost;
let pipeSpeed;
let pipeGap;
let pipeFrequency; // Số frame giữa các lần tạo ống
let pipeWidth;
let tankBodyWidth;
let tankBodyHeight;
let tankTurretWidth;
let tankTurretHeight;
let turretRotationSpeed;

// Biến game objects
let tank;
let pipes = [];
let frameCount = 0;

// Biến cho UI Buttons (sẽ định nghĩa vị trí trong resizeCanvas)
let playButtonRect = {};
let difficultyButtons = { easy: {}, medium: {}, hard: {} };

// --- IMAGE LOADING ---
const tankBodyImg = new Image();
const tankTurretImg = new Image();
const pipeTopImg = new Image();
const pipeBottomImg = new Image();
// const bgImg = new Image(); // Optional

let loadCounter = 0;
const totalAssets = 4; // tankBody, tankTurret, pipeTop, pipeBottom

function assetLoaded() {
    loadCounter++;
    if (loadCounter === totalAssets) {
        console.log("Assets loaded!");
        // Load high score sau khi ảnh tải xong và trước game loop
        loadHighScore();
        // Thiết lập kích thước và hằng số ban đầu
        resizeCanvas();
        // Reset trạng thái game trước khi bắt đầu
        resetGame(); // Reset với độ khó mặc định
        gameState = 'start'; // Đảm bảo bắt đầu ở màn hình start
        // Bắt đầu vòng lặp game
        gameLoop();
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
// bgImg.src = 'assets/background.png';

// --- HIGH SCORE FUNCTIONS ---
function loadHighScore() {
    const savedScore = localStorage.getItem('flappyTankHighScore');
    if (savedScore) {
        highScore = parseInt(savedScore, 10);
    }
    console.log("High Score loaded:", highScore);
}

function saveHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyTankHighScore', highScore.toString());
        console.log("New High Score saved:", highScore);
    }
}

// --- CORE GAME LOGIC ---

// Cập nhật các hằng số dựa trên độ khó và scaleFactor
function updateGameParameters() {
    const settings = difficultySettings[currentDifficulty];

    // Tính toán các giá trị dựa trên scaleFactor và độ khó
    gravity = settings.gravityFactor * scaleFactor;
    tankBoost = settings.boostFactor * scaleFactor;
    pipeSpeed = settings.pipeSpeedFactor * scaleFactor;
    pipeGap = settings.pipeGapFactor * scaleFactor;
    pipeFrequency = settings.pipeFrequency; // Tần suất không cần scale? Hoặc scale nhẹ?
    pipeWidth = 60 * scaleFactor; // Giữ cố định hoặc scale
    tankBodyWidth = 40 * scaleFactor;
    tankBodyHeight = 30 * scaleFactor;
    tankTurretWidth = 30 * scaleFactor;
    tankTurretHeight = 10 * scaleFactor;
    turretRotationSpeed = 0.05; // Giữ cố định

    // Khởi tạo/Cập nhật đối tượng tank nếu cần (ví dụ: sau khi resize)
    if (!tank) { // Chỉ khởi tạo lần đầu
       tank = {
            x: 80 * scaleFactor, // Vị trí bắt đầu
            y: canvas.height / 2 - (tankBodyHeight / 2),
            width: tankBodyWidth,
            height: tankBodyHeight,
            velocity: 0,
            turretAngle: 0
        };
    } else { // Cập nhật kích thước nếu đã tồn tại
        tank.width = tankBodyWidth;
        tank.height = tankBodyHeight;
        // Có thể cần cập nhật lại Y nếu tankHeight thay đổi đáng kể
        // tank.y = canvas.height / 2 - (tankBodyHeight / 2); // Reset Y khi resize?
    }
}

// Reset trạng thái game về ban đầu
function resetGame() {
    // Cập nhật thông số theo độ khó hiện tại
    updateGameParameters();

    // Đặt lại vị trí, vận tốc, góc quay của xe tăng
    tank.y = canvas.height / 2 - (tankBodyHeight / 2);
    tank.velocity = 0;
    tank.turretAngle = 0;

    pipes = []; // Xóa hết ống cũ
    score = 0;
    frameCount = 0; // Reset bộ đếm frame
    // gameState sẽ được đặt lại trong handleInput hoặc khi chuyển trạng thái
}

// --- RESIZE & UI SETUP ---
function resizeCanvas() {
    const aspectRatio = BASE_WIDTH / BASE_HEIGHT;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let canvasHeight = windowHeight * 0.95; // Dùng nhiều không gian hơn
    let canvasWidth = canvasHeight * aspectRatio;

    if (canvasWidth > windowWidth * 0.95) {
        canvasWidth = windowWidth * 0.95;
        canvasHeight = canvasWidth / aspectRatio;
    }

    canvas.width = Math.floor(canvasWidth);
    canvas.height = Math.floor(canvasHeight);

    // Cập nhật scaleFactor và các thông số game
    scaleFactor = canvas.height / BASE_HEIGHT; // Scale dựa trên chiều cao gốc
    updateGameParameters();

    // --- Xác định vị trí các nút bấm sau khi có kích thước canvas ---
    const btnWidth = 150 * scaleFactor;
    const btnHeight = 50 * scaleFactor;
    const btnSpacing = 20 * scaleFactor;

    // Nút Play
    playButtonRect = {
        x: canvas.width / 2 - btnWidth / 2,
        y: canvas.height * 0.55, // Đặt vị trí nút Play
        width: btnWidth,
        height: btnHeight
    };

    // Nút Độ khó
    const diffBtnWidth = 100 * scaleFactor;
    const diffBtnHeight = 40 * scaleFactor;
    const diffBtnY = canvas.height * 0.7; // Vị trí nhóm nút độ khó
    const totalDiffWidth = diffBtnWidth * 3 + btnSpacing * 2;
    let startX = canvas.width / 2 - totalDiffWidth / 2;

    difficultyButtons.easy = { x: startX, y: diffBtnY, width: diffBtnWidth, height: diffBtnHeight };
    startX += diffBtnWidth + btnSpacing;
    difficultyButtons.medium = { x: startX, y: diffBtnY, width: diffBtnWidth, height: diffBtnHeight };
    startX += diffBtnWidth + btnSpacing;
    difficultyButtons.hard = { x: startX, y: diffBtnY, width: diffBtnWidth, height: diffBtnHeight };
}

// Gọi lần đầu và lắng nghe sự kiện resize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


// --- UPDATE FUNCTIONS ---
function updateTank() {
    tank.velocity += gravity;
    tank.y += tank.velocity;
    tank.turretAngle += turretRotationSpeed;

    if (tank.y < 0) {
        tank.y = 0;
        tank.velocity = 0;
    }
    if (tank.y + tank.height > canvas.height) {
        tank.y = canvas.height - tank.height;
        tank.velocity = 0;
        // --- Chuyển sang Game Over ---
        saveHighScore(); // Lưu điểm cao nếu cần
        gameState = 'gameOver';
        // Có thể thêm âm thanh va chạm đất ở đây
    }
}

function createPipe() {
    const topPipeHeight = Math.random() * (canvas.height / 2 - pipeGap / 2 - 40 * scaleFactor) + 40 * scaleFactor; // Đảm bảo ống không quá ngắn
    const bottomPipeY = topPipeHeight + pipeGap;
    const bottomPipeHeight = canvas.height - bottomPipeY;

    pipes.push({
        x: canvas.width,
        width: pipeWidth,
        scored: false,
        topPipe: { y: 0, height: topPipeHeight },
        bottomPipe: { y: bottomPipeY, height: bottomPipeHeight }
    });
}

function updatePipes() {
    // Tạo ống mới dựa trên tần suất của độ khó
    if (frameCount % pipeFrequency === 0) {
        createPipe();
    }

    let collisionDetected = false;
    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed;

        // Kiểm tra va chạm (chính xác hơn một chút)
        const tankRect = { x: tank.x, y: tank.y, width: tank.width, height: tank.height };
        const topPipeRect = { x: pipe.x, y: pipe.topPipe.y, width: pipe.width, height: pipe.topPipe.height };
        const bottomPipeRect = { x: pipe.x, y: pipe.bottomPipe.y, width: pipe.width, height: pipe.bottomPipe.height };

        if (checkCollision(tankRect, topPipeRect) || checkCollision(tankRect, bottomPipeRect)) {
           collisionDetected = true;
        }

        // Tính điểm
        if (!pipe.scored && tank.x > pipe.x + pipe.width) { // Qua hẳn ống mới tính điểm
            score++;
            pipe.scored = true;
            // Có thể thêm âm thanh ghi điểm ở đây
        }
    });

     if (collisionDetected) {
        saveHighScore(); // Lưu điểm cao nếu cần
        gameState = 'gameOver';
         // Có thể thêm âm thanh va chạm ống ở đây
         // Có thể thêm hiệu ứng rung màn hình ở đây
    }

    // Xóa ống đã ra khỏi màn hình
    pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);
}

// Hàm kiểm tra va chạm giữa hai hình chữ nhật
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}


// --- DRAW FUNCTIONS ---
function drawTank() {
    ctx.drawImage(tankBodyImg, tank.x, tank.y, tank.width, tank.height);
    ctx.save();
    const pivotX = tank.x + tank.width / 2;
    const pivotY = tank.y + tank.height / 2;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tank.turretAngle);
    ctx.drawImage(
        tankTurretImg,
        0, -tankTurretHeight / 2,
        tankTurretWidth, tankTurretHeight
    );
    ctx.restore();
}

function drawPipes() {
    pipes.forEach(pipe => {
        ctx.drawImage(pipeTopImg, pipe.x, pipe.topPipe.y, pipe.width, pipe.topPipe.height);
        ctx.drawImage(pipeBottomImg, pipe.x, pipe.bottomPipe.y, pipe.width, pipe.bottomPipe.height);
    });
}

function drawScore(isGameOver = false) {
    const fontSize = isGameOver ? Math.floor(25 * scaleFactor) : Math.floor(35 * scaleFactor);
    const yPos = isGameOver ? canvas.height / 2 + 15 * scaleFactor : 60 * scaleFactor;

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2 * scaleFactor;
    ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`; // Font khác biệt
    ctx.textAlign = 'center';
    ctx.strokeText(score, canvas.width / 2, yPos);
    ctx.fillText(score, canvas.width / 2, yPos);
}

function drawStartScreen() {
    // Nền tối mờ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tiêu đề
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.floor(45 * scaleFactor)}px 'Arial Black', Gadget, sans-serif`;
    ctx.fillText('Flappy Tank', canvas.width / 2, canvas.height * 0.15);

    // Điểm cao nhất
    ctx.font = `bold ${Math.floor(20 * scaleFactor)}px Arial`;
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height * 0.25);

    // --- Vẽ Nút Play ---
    ctx.fillStyle = '#4CAF50'; // Màu xanh lá
    ctx.fillRect(playButtonRect.x, playButtonRect.y, playButtonRect.width, playButtonRect.height);
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.floor(25 * scaleFactor)}px Arial`;
    ctx.fillText('Chơi', playButtonRect.x + playButtonRect.width / 2, playButtonRect.y + playButtonRect.height / 2 + 8 * scaleFactor); // Căn chữ giữa nút

    // --- Vẽ Nút Chọn Độ Khó ---
    ctx.font = `bold ${Math.floor(18 * scaleFactor)}px Arial`;
    for (const diff in difficultyButtons) {
        const btn = difficultyButtons[diff];
        // Màu nền dựa trên độ khó hiện tại
        ctx.fillStyle = (diff === currentDifficulty) ? '#FFC107' : '#607D8B'; // Vàng nếu được chọn, xám nếu không
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        // Màu chữ
        ctx.fillStyle = 'white';
        ctx.fillText(diff.charAt(0).toUpperCase() + diff.slice(1), btn.x + btn.width / 2, btn.y + btn.height / 2 + 6 * scaleFactor); // Căn chữ
    }

     // --- Thông tin thêm ---
    const infoFontSize = Math.floor(14 * scaleFactor);
    ctx.font = `${infoFontSize}px Arial`;
    ctx.fillStyle = '#ccc'; // Màu chữ thông tin mờ hơn
    const startYInfo = canvas.height * 0.85;
    const lineSpacing = infoFontSize * 1.5;
    ctx.fillText('Create by: [Tao]', canvas.width / 2, startYInfo);
    ctx.fillText('Contact: [Lồn]', canvas.width / 2, startYInfo + lineSpacing);
}


function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Tối hơn chút
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'red';
    ctx.font = `bold ${Math.floor(40 * scaleFactor)}px 'Arial Black', Gadget, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER!', canvas.width / 2, canvas.height * 0.35);

    // Hiển thị điểm cuối cùng
    drawScore(true); // Gọi drawScore với flag game over

    // Hiển thị điểm cao nhất
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.floor(20 * scaleFactor)}px Arial`;
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height * 0.6);


    // Hướng dẫn chơi lại
    ctx.font = `${Math.floor(22 * scaleFactor)}px Arial`;
    ctx.fillText('Nhấn để Chơi lại', canvas.width / 2, canvas.height * 0.75);
}

// --- INPUT HANDLING ---
function handleInput(event) {
    // Lấy tọa độ click/touch tương đối với canvas
    const rect = canvas.getBoundingClientRect();
    let clickX, clickY;
    if (event.type === 'mousedown') {
        clickX = event.clientX - rect.left;
        clickY = event.clientY - rect.top;
    } else if (event.type === 'touchstart') {
        // Chỉ lấy touch đầu tiên
        clickX = event.touches[0].clientX - rect.left;
        clickY = event.touches[0].clientY - rect.top;
    } else { // Keyboard input (Space, ArrowUp)
        if (gameState === 'playing') {
            tank.velocity = tankBoost;
             // Có thể thêm âm thanh nhảy ở đây
        } else if (gameState === 'gameOver' || gameState === 'start') {
            // Bàn phím sẽ chỉ bắt đầu game (không chọn độ khó)
             if(gameState === 'start') { // Chỉ reset nếu đang ở màn hình start
                 resetGame();
             } else { // Nếu đang game over thì cũng reset
                 resetGame();
             }
            gameState = 'playing';
        }
        return; // Không cần xử lý tọa độ cho keyboard
    }


    // Xử lý click/touch dựa trên trạng thái game
    if (gameState === 'start') {
        // Kiểm tra click vào nút Play
        if (isClickInsideRect(clickX, clickY, playButtonRect)) {
            resetGame(); // Reset với độ khó đã chọn
            gameState = 'playing';
            return; // Đã xử lý, thoát
        }
        // Kiểm tra click vào nút Độ khó
        for (const diff in difficultyButtons) {
            if (isClickInsideRect(clickX, clickY, difficultyButtons[diff])) {
                currentDifficulty = diff; // Cập nhật độ khó
                // Không cần reset game ngay, chỉ đổi màu nút khi vẽ lại
                console.log("Difficulty set to:", currentDifficulty);
                return; // Đã xử lý, thoát
            }
        }
         // Nếu click vào đâu đó khác ngoài nút -> không làm gì hoặc bắt đầu game? (Hiện tại không làm gì)

    } else if (gameState === 'playing') {
        tank.velocity = tankBoost;
         // Có thể thêm âm thanh nhảy ở đây
    } else if (gameState === 'gameOver') {
        // Click bất kỳ để quay lại màn hình start
        gameState = 'start';
        // Không cần reset game ở đây, sẽ reset khi nhấn nút Play
    }
}

// Helper kiểm tra click/touch có nằm trong hình chữ nhật không
function isClickInsideRect(x, y, rect) {
    return (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
    );
}

// Lắng nghe sự kiện
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); // Ngăn cuộn trang trên mobile
    handleInput(event);
});
window.addEventListener('keydown', (e) => {
    // Chỉ xử lý Space hoặc ArrowUp, và không cần tọa độ
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault(); // Ngăn Space cuộn trang
        handleInput(e); // Gọi handleInput với event keyboard
    }
});


// --- GAME LOOP ---
function gameLoop(timestamp) { // timestamp từ requestAnimationFrame
    // Xóa màn hình
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vẽ nền (màu hoặc ảnh)
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    // Logic và Vẽ dựa trên trạng thái game
    switch (gameState) {
        case 'playing':
            updateTank();
            updatePipes();
            frameCount++;

            drawPipes();
            drawTank();
            drawScore();
            break;
        case 'gameOver':
            // Vẽ trạng thái cuối cùng của game
            drawPipes();
            drawTank();
            // Vẽ màn hình Game Over lên trên
            drawGameOverScreen();
            break;
        case 'start':
        default: // Mặc định hiển thị màn hình start
            // Vẽ xe tăng tĩnh ở màn hình chờ
             if (tank) drawTank(); // Đảm bảo tank đã khởi tạo
            // Vẽ màn hình bắt đầu (với các nút)
            drawStartScreen();
            break;
    }

    // Yêu cầu frame tiếp theo
    requestAnimationFrame(gameLoop);
}

// --- START GAME ---
console.log("Loading assets...");
// Game sẽ bắt đầu trong assetLoaded() -> gameLoop()
