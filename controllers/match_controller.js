const { Player } = require('../entity/player.js');
const { Position } = require('../entity/position.js');
/**
 * Coneected players
 */
var connectedPlayers = [];

class MatchController {

    getConnectedPlayers() {
        return connectedPlayers;
    }

    generateNewPlayer(socket) {
        const newPlayer = new Player(
            socket.id,
            new Position(100, 100),
            getRandomColor(),
        );

        connectedPlayers.push(newPlayer);

        console.log("User connected! " + socket.id + " players " + JSON.stringify(connectedPlayers));

        return { newPlayer: newPlayer, players: connectedPlayers };
    }

    removePlayer(socket) {
        console.log("Player Disconnected! " + socket.id + " players " + JSON.stringify(connectedPlayers));
        const index = connectedPlayers.findIndex(data => data.id == socket.id);
        if (index > -1) {
            connectedPlayers.splice(index, 1);
        }
        console.log("Player Disconnected! Remove index " + index + " players " + JSON.stringify(connectedPlayers));
    }
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

module.exports = {
    MatchController,
};