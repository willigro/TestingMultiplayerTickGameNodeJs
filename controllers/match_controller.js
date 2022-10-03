const { Player } = require('../entity/player.js');
const { Position } = require('../entity/position.js');
const { PlayerMovementController } = require('./player_movement_controller.js');
const { PlayerShootingController } = require('./player_shooting_controller.js');
/**
 * Coneected players
 */
var connectedPlayers = [];

const playerMovementController = new PlayerMovementController();
const playerShootingController = new PlayerShootingController();

const DELAY = 1000 / 30; // rollback t0 30 FPS

// TODO move it
const PLAYER_VELOCITY = 8

class PlayerMovement {
    constructor(position, angle, strength, velocity) {
        this.position = position;
        this.angle = angle;
        this.strength = strength;
        this.velocity = velocity;
    }
}

class MatchController {

    constructor(updateWorldState) {
        this.interval = null;
        this.updateWorldState = updateWorldState;
        this.packgeState = null;
    }

    getConnectedPlayers() {
        return connectedPlayers;
    }

    generateNewPlayer(socket) {
        const newPlayer = new Player(
            socket.id,
            new PlayerMovement(
                new Position(100, 100),
                0,
                0,
                PLAYER_VELOCITY,
            ),
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

    initGame() {
        this.interval = setInterval(function() {
            this.update();

            this.packgeState = {
                players: connectedPlayers
            }

            // for (var i = 0; i < connectedPlayers.length; i++) {
            //     console.log(connectedPlayers[i].id)
            // }

            this.updateWorldState(this.packgeState);

            this.packgeState = null;
        }.bind(this), DELAY);
    }

    update() {
        for (var i = 0; i < connectedPlayers.length; i++) {
            const player = connectedPlayers[i];

            if (player.isMoving()) {
                player.setPosition(
                    playerMovementController.calculateNewPosition(
                        player.playerMovement.angle,
                        player.playerMovement.strength,
                        player.playerMovement.position.x,
                        player.playerMovement.position.y,
                        player.playerMovement.velocity,
                    )
                );
            }
        }
    }

    playerUpdate(id, payload) {
        const player = this.getPlayerById(id);
        if (!player) {
            console.log("PLAYER NOT FOUND " + player);
            return;
        }

        const data = JSON.parse(payload);

        player.playerMovement.angle = data.playerMovement.angle;
        player.playerMovement.strength = data.playerMovement.strength;
        player.playerMovement.velocity = data.playerMovement.velocity;
        player.setPosition(
            playerMovementController.calculateNewPosition(
                data.playerMovement.angle,
                data.playerMovement.strength,
                player.playerMovement.position.x,
                player.playerMovement.position.y,
                data.playerMovement.velocity,
            )
        );
    }

    getPlayerById(id) {
        return this.getConnectedPlayers().find(player => player.id == id);
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