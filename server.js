const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Game state
let ball = {
    x: 600,
    y: 300,
    radius: 10,
    speedX: 4,
    speedY: 4,
};

let paddle1 = { y: 250 };
let paddle2 = { y: 250 };
let score = { player1: 0, player2: 0 };
let playerNames = { player1: 'Player 1', player2: 'Player 2' };

// Track players
let players = { player1: null, player2: null };

// Helper function to assign a player
function assignPlayer(socket) {
    if (!players.player1) {
        players.player1 = socket.id;
        return 'player1';
    } else if (!players.player2) {
        players.player2 = socket.id;
        return 'player2';
    }
    return null; // Spectator (no slot available)
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Assign player or spectator
    const player = assignPlayer(socket);
    if (player) {
        console.log(`${socket.id} assigned as ${player}`);
        socket.emit('assignPlayer', player);
    } else {
        console.log(`${socket.id} is a spectator`);
        socket.emit('assignPlayer', 'spectator');
    }

    // Handle player name submission
    socket.on('setPlayerName', (name) => {
        if (player === 'player1' || player === 'player2') {
            playerNames[player] = name || `Unnamed ${player}`;
            io.emit('updatePlayerNames', playerNames);
        }
    });

    // Initial game state
    socket.emit('gameState', { ball, paddle1, paddle2, score, playerNames });

    // Handle paddle movement
    socket.on('paddleMove', (data) => {
        if (player === 'player1') {
            paddle1.y = data.y;
        } else if (player === 'player2') {
            paddle2.y = data.y;
        }
        io.emit('updatePaddles', { paddle1Y: paddle1.y, paddle2Y: paddle2.y });
    });

    // Game loop for ball movement
    const gameLoop = setInterval(() => {
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        if (ball.y - ball.radius < 0 || ball.y + ball.radius > 600) {
            ball.speedY *= -1;
        }

        if (
            (ball.x - ball.radius < 20 && ball.y > paddle1.y && ball.y < paddle1.y + 100) ||
            (ball.x + ball.radius > 1180 && ball.y > paddle2.y && ball.y < paddle2.y + 100)
        ) {
            ball.speedX *= -1;
        }

        if (ball.x - ball.radius < 0) {
            score.player2++;
            resetBall();
        } else if (ball.x + ball.radius > 1200) {
            score.player1++;
            resetBall();
        }

        io.emit('updateBall', { x: ball.x, y: ball.y });
        io.emit('updateScore', score);
    }, 1000 / 60);

    const resetBall = () => {
        ball = {
            x: 600,
            y: 300,
            radius: 10,
            speedX: 4 * (Math.random() > 0.5 ? 1 : -1),
            speedY: 4 * (Math.random() > 0.5 ? 1 : -1),
        };
    };

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Reassign player slots
        if (players.player1 === socket.id) {
            players.player1 = null;
            playerNames.player1 = 'Player 1';
        } else if (players.player2 === socket.id) {
            players.player2 = null;
            playerNames.player2 = 'Player 2';
        }

        // Broadcast updated player names
        io.emit('updatePlayerNames', playerNames);

        clearInterval(gameLoop);
    });
});

app.use(express.static('public'));

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
