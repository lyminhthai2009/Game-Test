const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnTurretUp = document.getElementById('btn-turret-up');
const btnTurretDown = document.getElementById('btn-turret-down');

let canvasWidth, canvasHeight;

// Định nghĩa trạng thái và thuộc tính của xe tăng
const tank = {
    x: 100, // Vị trí ban đầu (sẽ được cập nhật dựa trên kích thước canvas)
    y: 0,   // Vị trí Y (sẽ được đặt ở đáy canvas)
    width: 50,
    height: 25,
    color: '#D9534F', // Màu đỏ cam tươi
    speed: 2,
    turret: {
        length: 35,
        width: 8,
        angle: -Math.PI / 6, // Góc ban đầu (hơi chếch lên, 0 là ngang)
        color: '#5CB85C', // Màu xanh lá cây
        angleSpeed: 0.03 // Tốc độ xoay nòng
    },
    isMovingLeft: false,
    isMovingRight: false,
    isTurretMovingUp: false,
    isTurretMovingDown: false
};

// Hàm vẽ xe tăng
function drawTank() {
    // --- Vẽ thân xe ---
    ctx.fillStyle = tank.color;
    // Vẽ từ góc dưới bên trái để y=0 là đáy canvas
    ctx.fillRect(tank.x, tank.y - tank.height, tank.width, tank.height);

    // --- Vẽ nòng súng ---
    ctx.save(); // Lưu trạng thái canvas hiện tại (vị trí, góc xoay)

    // Di chuyển gốc tọa độ đến điểm xoay của nòng súng (giữa, trên thân xe)
    const pivotX = tank.x + tank.width / 2;
    const pivotY = tank.y - tank.height;
    ctx.translate(pivotX, pivotY);

    // Xoay canvas theo góc của nòng súng
    ctx.rotate(tank.turret.angle);

    // Vẽ nòng súng (vẽ từ gốc tọa độ mới)
    ctx.fillStyle = tank.turret.color;
    // Vẽ bắt đầu từ gốc, tâm nòng trùng gốc tọa độ
    ctx.fillRect(0, -tank.turret.width / 2, tank.turret.length, tank.turret.width);

    ctx.restore(); // Khôi phục trạng thái canvas trước đó
}

// Hàm cập nhật trạng thái xe tăng
function updateTank() {
    // Di chuyển trái/phải
    if (tank.isMovingLeft && tank.x > 0) {
        tank.x -= tank.speed;
    }
    if (tank.isMovingRight && tank.x < canvasWidth - tank.width) {
        tank.x += tank.speed;
    }

    // Xoay nòng súng (giới hạn góc xoay)
    const minAngle = -Math.PI / 2 + 0.1; // Gần thẳng đứng lên
    const maxAngle = Math.PI / 6;       // Hơi chúc xuống
    if (tank.isTurretMovingUp && tank.turret.angle > minAngle) {
        tank.turret.angle -= tank.turret.angleSpeed;
    }
    if (tank.isTurretMovingDown && tank.turret.angle < maxAngle) {
        tank.turret.angle += tank.turret.angleSpeed;
    }
    // Đảm bảo góc không vượt quá giới hạn (phòng trường hợp lỗi)
     tank.turret.angle = Math.max(minAngle, Math.min(maxAngle, tank.turret.angle));
}


// Vòng lặp game chính (Animation Loop)
function gameLoop() {
    // 1. Xóa màn hình cũ
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Cập nhật trạng thái (vị trí, góc xoay)
    updateTank();

    // 3. Vẽ lại mọi thứ ở trạng thái mới
    // Vẽ nền đất (đơn giản)
    // ctx.fillStyle = '#90EE90'; // Màu cỏ (đã set background cho container)
    // ctx.fillRect(0, canvasHeight - 20, canvasWidth, 20); // Vẽ 1 dải đất nhỏ ở dưới nếu muốn

    drawTank();

    // 4. Lặp lại cho khung hình tiếp theo (tạo animation mượt)
    requestAnimationFrame(gameLoop);
}

// Hàm xử lý thay đổi kích thước cửa sổ/canvas
function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    // Cập nhật lại vị trí Y của xe tăng để nó luôn ở đáy
    tank.y = canvasHeight; // Đặt đáy xe tăng ở đáy canvas

     // Đặt lại vị trí X ban đầu nếu cần (ví dụ: luôn ở giữa khi resize)
     // tank.x = canvasWidth / 2 - tank.width / 2;
}

// --- Xử lý sự kiện nhấn/nhả nút (Hỗ trợ cả chuột và chạm) ---
function handleInteraction(button, stateKey, isPressed) {
    tank[stateKey] = isPressed;
}

// Sử dụng mousedown/mouseup cho chuột và touchstart/touchend cho chạm
// Di chuyển
btnLeft.addEventListener('mousedown', () => handleInteraction(btnLeft, 'isMovingLeft', true));
btnLeft.addEventListener('mouseup', () => handleInteraction(btnLeft, 'isMovingLeft', false));
btnLeft.addEventListener('mouseleave', () => handleInteraction(btnLeft, 'isMovingLeft', false)); // Dừng khi chuột ra khỏi nút
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteraction(btnLeft, 'isMovingLeft', true); }, { passive: false });
btnLeft.addEventListener('touchend', () => handleInteraction(btnLeft, 'isMovingLeft', false));

btnRight.addEventListener('mousedown', () => handleInteraction(btnRight, 'isMovingRight', true));
btnRight.addEventListener('mouseup', () => handleInteraction(btnRight, 'isMovingRight', false));
btnRight.addEventListener('mouseleave', () => handleInteraction(btnRight, 'isMovingRight', false));
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteraction(btnRight, 'isMovingRight', true); }, { passive: false });
btnRight.addEventListener('touchend', () => handleInteraction(btnRight, 'isMovingRight', false));

// Xoay nòng
btnTurretUp.addEventListener('mousedown', () => handleInteraction(btnTurretUp, 'isTurretMovingUp', true));
btnTurretUp.addEventListener('mouseup', () => handleInteraction(btnTurretUp, 'isTurretMovingUp', false));
btnTurretUp.addEventListener('mouseleave', () => handleInteraction(btnTurretUp, 'isTurretMovingUp', false));
btnTurretUp.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteraction(btnTurretUp, 'isTurretMovingUp', true); }, { passive: false });
btnTurretUp.addEventListener('touchend', () => handleInteraction(btnTurretUp, 'isTurretMovingUp', false));

btnTurretDown.addEventListener('mousedown', () => handleInteraction(btnTurretDown, 'isTurretMovingDown', true));
btnTurretDown.addEventListener('mouseup', () => handleInteraction(btnTurretDown, 'isTurretMovingDown', false));
btnTurretDown.addEventListener('mouseleave', () => handleInteraction(btnTurretDown, 'isTurretMovingDown', false));
btnTurretDown.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteraction(btnTurretDown, 'isTurretMovingDown', true); }, { passive: false });
btnTurretDown.addEventListener('touchend', () => handleInteraction(btnTurretDown, 'isTurretMovingDown', false));


// --- Khởi tạo và bắt đầu ---
window.addEventListener('resize', resizeCanvas); // Gọi resize khi cửa sổ thay đổi kích thước
resizeCanvas(); // Gọi lần đầu để đặt kích thước canvas
gameLoop(); // Bắt đầu vòng lặp game