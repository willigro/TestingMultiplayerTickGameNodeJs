var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

const ON_CONNECTION = "connection"
const ON_DISCONNECT = "disconnect"
const ON_PLAYER_MOVEMENT = "player movement"

const EMIT_NEW_PLAYER_CONNECTED = "new player connected"
const EMIT_PLAYER_CREATED = "player created"
const EMIT_PLAYER_DISCONNECTED = "player disconnected"
const EMIT_PLAYERS_MOVEMENT = "players movement"

/**
 * Coneected players
 * 
 */
var connectedPlayers = [];

/**
 * TODO: I wanna make a way to send package of data, it means that I'm going to receive X request per T time,
 * stack them and then emit to the clients
 * 
 * Example:
 *  Get the positions, calculate them and then emit the new player position, it means that I'll need
 *  to change the EMIT_PLAYER_MOVED to emit a list of players
 * 
 * 
 * 
 * TODO: Convert the JSON to proper CLASSES
 * 
 * TODO: create a way to check if some player was disconnected because I cannot guarantee that the 
 * app will call the disconnect by it self
 * 
 * TODO: Collisions, who will control the collider is the server, I'm going to decide and notify the collisions
 * The app will still keep checking it, but won't give the last word, such as if the damage was taken or if the
 * collisions really happens
 * **/

server.listen(port, function() {
    console.log('Server listening at port %d', port);
});

io.on(ON_CONNECTION, function(socket) {

    var newPlayer = generateNewPlayer(socket);

    connectedPlayers.push(newPlayer);

    console.log("User connected! " + socket.id + " players " + JSON.stringify(connectedPlayers));

    // Send to all clients except the sender
    emitToAllExceptTheSender(socket, EMIT_NEW_PLAYER_CONNECTED, { newPlayer: newPlayer, players: connectedPlayers });
    emitToAll(socket, EMIT_PLAYER_CREATED, { newPlayer: newPlayer, players: connectedPlayers });

    setupListeners(socket);
});

function setupListeners(socket) {
    onPlayerDisconnected(socket);
    onPlayerMoved(socket);
}

function emitToAll(socket, tag, payload) {
    socket.emit(tag, payload);
}

function emitToAllExceptTheSender(socket, tag, payload) {
    socket.broadcast.emit(tag, payload);
}

function generateNewPlayer(socket) {
    return { id: socket.id, position: { x: 100, y: 100 }, color: getRandomColor() }
}

function onPlayerDisconnected(socket) {
    socket.on(ON_DISCONNECT, function() {
        removePlayer(socket)

        emitToAllExceptTheSender(socket, EMIT_PLAYER_DISCONNECTED, { id: socket.id, players: connectedPlayers });
    });
}

function onPlayerMoved(socket) {
    socket.on(ON_PLAYER_MOVEMENT, function(payload) {

        const data = JSON.parse(payload);

        // console.log(data)

        const newPosition = calculateNewPosition(
            data.playerMovement.angle,
            data.playerMovement.strength,
            data.playerMovement.x,
            data.playerMovement.y,
            data.playerMovement.velocity,
        );

        // const newAim = calculateNewAimPosition(
        //     ...
        // );

        const playerMovement = {
            angle: data.playerMovement.angle,
            strength: data.playerMovement.strength,
            x: data.playerMovement.x,
            y: data.playerMovement.y,
            newPosition: newPosition,
            velocity: data.playerMovement.velocity,
        };

        const playerAim = {
            angle: data.playerAim.angle,
            strength: data.playerAim.strength,
        }

        const playerMovementResult = {
            id: socket.id,
            playerMovement: playerMovement,
            playerAim: playerAim,
        }

        updatePlayerMovementAndAimValues(
            socket.id,
            playerMovement,
            playerAim,
        );

        // Testing delay
        // sleep(1000).then(() => {
        //     emitToAllExceptTheSender(socket, EMIT_PLAYER_MOVED, { playerMovement: playerMovement });
        // });

        emitToAllExceptTheSender(socket, EMIT_PLAYERS_MOVEMENT, { playerMovementResult: playerMovementResult });
    });
}

function updatePlayerMovementAndAimValues(id, playerMovement, playerAim) {
    const index = connectedPlayers.findIndex(data => data.id == id);
    if (index > -1) {
        connectedPlayers[index].position.x = playerMovement.x
        connectedPlayers[index].position.y = playerMovement.y
    }
}

function removePlayer(socket) {
    console.log("Player Disconnected! " + socket.id + " players " + JSON.stringify(connectedPlayers));
    const index = connectedPlayers.findIndex(data => data.id == socket.id);
    if (index > -1) {
        connectedPlayers.splice(index, 1);
    }
    console.log("Player Disconnected! Remove index " + index + " players " + JSON.stringify(connectedPlayers));
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function calculateNewPosition(angle, strength, x, y, velocity) {
    var newX = Math.cos(angle * Math.PI / 180.0) * strength
    var newY = -Math.sin(angle * Math.PI / 180.0) * strength

    const position = new Position(
        newX, newY
    )

    position.normalize()

    newX = position.x * velocity + x;
    newY = position.y * velocity + y;

    return new Position(newX, newY);
}

class Position {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const len = this.length();

        if (len == 0.0) {
            this.x = 0.0;
            this.y = 0.0;
        } else {
            this.x = this.x / len;
            this.y = this.y / len;
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}