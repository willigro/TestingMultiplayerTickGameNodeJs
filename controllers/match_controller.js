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

        this.getConnectedPlayers().push(newPlayer);

        console.log("User connected! " + socket.id + " players " + JSON.stringify(this.getConnectedPlayers()));

        return { newPlayer: newPlayer, players: this.getConnectedPlayers() };
    }

    removePlayer(socket) {
        console.log("Player Disconnected! " + socket.id + " players " + JSON.stringify(this.getConnectedPlayers()));
        const index = this.getConnectedPlayers().findIndex(player => player.id == socket.id);
        if (index > -1) {
            this.getConnectedPlayers().splice(index, 1);
        }
        console.log("Player Disconnected! Remove index " + index + " players " + JSON.stringify(this.getConnectedPlayers()));
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