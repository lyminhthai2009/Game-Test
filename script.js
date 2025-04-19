// ... (Phần đầu file giữ nguyên: canvas, ctx, khai báo biến...)

// --- HÀM CẬP NHẬT HẰNG SỐ ---
function updateGameConstants() {
    // --- GIẢM TỐC ĐỘ GAME ---
    gravity = 0.25 * scaleFactor; // Giảm nhẹ trọng lực (tùy chọn)
    tankBoost = -5.5 * scaleFactor; // Giảm nhẹ lực nhảy (tùy chọn, điều chỉnh cho phù hợp)
    pipeSpeed = 1.5 * scaleFactor; // << GIẢM TỐC ĐỘ ỐNG DI CHUYỂN
    // --- ---

    pipeGap = 130 * scaleFactor; // Có thể tăng nhẹ gap cho dễ hơn
    pipeWidth = 60 * scaleFactor;
    tankBodyWidth = 40 * scaleFactor;
    tankBodyHeight = 30 * scaleFactor;
    tankTurretWidth = 30 * scaleFactor;
    tankTurretHeight = 10 * scaleFactor;
    turretRotationSpeed = 0.05;
}

// ... (Phần biến game, tải ảnh giữ nguyên) ...

// --- Hàm Vẽ ---

// ... (drawTank, drawPipes, drawScore giữ nguyên) ...

function drawStartScreen() {
    // Vẽ nền tối mờ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vẽ chữ chính
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center'; // Căn giữa chữ

    // 1. Tiêu đề Game (Tùy chọn)
    ctx.font = `bold ${Math.floor(35 * scaleFactor)}px Arial`;
    ctx.fillText('Flappy Tank', canvas.width / 2, canvas.height * 0.3); // Đẩy lên cao hơn chút

    // 2. Hướng dẫn bắt đầu
    ctx.font = `${Math.floor(25 * scaleFactor)}px Arial`;
    ctx.fillText('Nhấn để Bắt đầu', canvas.width / 2, canvas.height * 0.5); // Vị trí hướng dẫn chính

    // --- THÊM THÔNG TIN GIỚI THIỆU ---
    const infoFontSize = Math.floor(16 * scaleFactor);
    ctx.font = `${infoFontSize}px Arial`;
    const startYInfo = canvas.height * 0.7; // Vị trí bắt đầu cho thông tin thêm
    const lineSpacing = infoFontSize * 1.5; // Khoảng cách dòng

    ctx.fillText('Create by: [Tên Của Bạn]', canvas.width / 2, startYInfo);
    ctx.fillText('Liên hệ: [Email hoặc Mạng xã hội của bạn]', canvas.width / 2, startYInfo + lineSpacing);
    // Thêm dòng khác nếu muốn
    // ctx.fillText('Phiên bản: 1.0', canvas.width / 2, startYInfo + lineSpacing * 2);
    // --- KẾT THÚC THÔNG TIN GIỚI THIỆU ---
}


function drawGameOverScreen() {
    // ... (Giữ nguyên như cũ) ...
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'red';
    ctx.font = `bold ${Math.floor(30 * scaleFactor)}px Arial`; // Đảm bảo dùng font đậm
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER!', canvas.width / 2, canvas.height / 2 - 40 * scaleFactor);
    ctx.fillStyle = 'white';
    ctx.font = `${Math.floor(20 * scaleFactor)}px Arial`;
    ctx.fillText(`Điểm: ${score}`, canvas.width / 2, canvas.height / 2);
    ctx.fillText('Nhấn để Chơi lại', canvas.width / 2, canvas.height / 2 + 40 * scaleFactor);
}


// --- Hàm Cập nhật ---

// ... (updateTank giữ nguyên) ...

function createPipe() {
   // ... (Giữ nguyên logic tạo ống) ...
    const topPipeHeight = Math.random() * (canvas.height / 2 - pipeGap / 2) + 50 * scaleFactor;
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
    // --- TĂNG KHOẢNG CÁCH XUẤT HIỆN ỐNG ---
    // Tăng giá trị này để ống xuất hiện thưa hơn (game chậm hơn)
    if (frameCount % 200 === 0) { // Ví dụ: tăng từ 120 lên 200
        createPipe();
    }
    // --- ---

    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed; // Sử dụng pipeSpeed đã được giảm

        // Kiểm tra va chạm (giữ nguyên)
        const tankRight = tank.x + tank.width;
        const tankBottom = tank.y + tank.height;
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

        // Tính điểm (giữ nguyên)
        if (!pipe.scored && tank.x > pipe.x + pipe.width / 2) {
            score++;
            pipe.scored = true;
        }
    });

    // Xóa ống (giữ nguyên)
    pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);
}

// ... (handleInput, resetGame, gameLoop, phần tải ảnh, event listener giữ nguyên) ...
