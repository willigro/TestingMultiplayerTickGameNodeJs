var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

const { MatchController } = require('./controllers/match_controller.js');
const { PlayerMovementController } = require('./controllers/player_movement_controller.js');

const ON_CONNECTION = "connection"
const ON_DISCONNECT = "disconnect"
const ON_PLAYER_MOVEMENT = "player movement"

const EMIT_NEW_PLAYER_CONNECTED = "new player connected"
const EMIT_PLAYER_CREATED = "player created"
const EMIT_PLAYER_DISCONNECTED = "player disconnected"
const EMIT_PLAYERS_MOVEMENT = "players movement"

/*
 * Controllers
 */
const matchController = new MatchController();
const playerMovementController = new PlayerMovementController(matchController);


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

    var response = matchController.generateNewPlayer(socket);

    // Send to all clients except the sender
    emitToAllExceptTheSender(socket, EMIT_NEW_PLAYER_CONNECTED, response);
    emitToAll(socket, EMIT_PLAYER_CREATED, response);

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

function onPlayerDisconnected(socket) {
    socket.on(ON_DISCONNECT, function() {
        matchController.removePlayer(socket)

        emitToAllExceptTheSender(socket, EMIT_PLAYER_DISCONNECTED, { id: socket.id, players: matchController.getConnectedPlayers() });
    });
}

function onPlayerMoved(socket) {
    socket.on(ON_PLAYER_MOVEMENT, function(payload) {

        const response = playerMovementController.onPlayerMoved(socket, payload);
        // Testing delay
        // sleep(1000).then(() => {
        //     emitToAllExceptTheSender(socket, EMIT_PLAYER_MOVED, { playerMovement: playerMovement });
        // });

        emitToAllExceptTheSender(socket, EMIT_PLAYERS_MOVEMENT, { playerMovementResult: response });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}