var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

const { MatchController } = require('./controllers/match_controller.js');

const ON_CONNECTION = "connection"
const ON_DISCONNECT = "disconnect"
const ON_PLAYER_UPDATE = "player update"
const ON_PLAYER_SHOOTING = "player shooting"
const ON_GAME_MUST_STOP = "game must stop"

const EMIT_NEW_PLAYER_CONNECTED = "new player connected"
const EMIT_PLAYER_CREATED = "player created"
const EMIT_PLAYER_DISCONNECTED = "player disconnected"
const EMIT_WORLD_STATE = "world state"
const EMIT_GAME_STARTED = "on game started"

/*
 * Controllers
 */

const matchController = new MatchController();


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
// io.sockets.on('connection', function(socket) {
//     console.log("conneceted " + socket.id);
// })
io.on(ON_CONNECTION, function(socket) {

    console.log("ON CONNECTION, " + socket.id);
    // console.log(socket.conn.server.clientsCount);
    // console.log(socket.server.engine.clientsCount);
    matchController.updateWorldState = function(response) {

        // sleep(200);
        emitToAll(io, EMIT_WORLD_STATE, response);
    }

    var response = matchController.generateNewPlayer(socket);

    // Send to all clients except the sender
    emitToAllExceptTheSender(socket, EMIT_NEW_PLAYER_CONNECTED, response);
    emitToAll(socket, EMIT_PLAYER_CREATED, response);

    setupListeners(socket);

    if (matchController.getConnectedPlayers().length == 2) {
        emitToAll(io, EMIT_GAME_STARTED, { tick: matchController.server_tick_number });
        sleep(1000);
        matchController.initGame();
    }
});

function setupListeners(socket) {
    onPlayerDisconnected(socket);
    onPlayerUpdate(socket);
    onPlayerShooting(socket);


    onGameMustStop(socket);
}

function emitToAll(emiter, tag, payload) {
    emiter.emit(tag, payload);
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

function onPlayerUpdate(socket) {
    socket.on(ON_PLAYER_UPDATE, function(payload) {
        // THIS ID MUST COME FROM THE APP
        matchController.onPlayerUpdated(socket.id, payload)
    });
}

function onPlayerShooting(socket) {
    socket.on(ON_PLAYER_SHOOTING, function(payload) {
        // THIS ID MUST COME FROM THE APP
        // matchController.onPlayerShooting(payload)
    });
}

function onGameMustStop(socket) {
    socket.on(ON_GAME_MUST_STOP, function(payload) {
        matchController.onGameMustStop()
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}