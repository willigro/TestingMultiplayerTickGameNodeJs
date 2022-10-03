const { Player } = require('../entity/player.js');
const { PlayerAim } = require('../entity/player_aim.js');
const { Position } = require('../entity/position.js');
const { Bullet } = require('../entity/bullet.js');
const { PlayerMovement } = require('../entity/player_movement.js');
const { PlayerMovementController } = require('./player_movement_controller.js');
const { PlayerShootingController } = require('./player_shooting_controller.js');
/**
 * Coneected players
 */
var connectedPlayers = [];

var bullets = [];

const playerMovementController = new PlayerMovementController();
const playerShootingController = new PlayerShootingController();

const DELAY = 1000 / 30; // rollback to 30 FPS

// TODO move it
const PLAYER_VELOCITY = 8

class MatchController {

    constructor(updateWorldState) {
        this.interval = null;
        this.updateWorldState = updateWorldState;
        this.packgeState = null;
    }

    getConnectedPlayers() {
        return connectedPlayers;
    }

    getBullets() {
        return bullets;
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
            new PlayerAim(
                0,
                0,
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
                players: this.getConnectedPlayers(),
                bullets: this.getBullets()
            }

            this.updateWorldState(this.packgeState);

            this.packgeState = null;
        }.bind(this), DELAY);
    }

    update() {
        for (var i = 0; i < this.getConnectedPlayers().length; i++) {
            const player = this.getConnectedPlayers()[i];
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

        for (var i = 0; i < this.getBullets().length; i++) {
            const bullet = this.getBullets()[i];
            // console.log(bullet.isMoving())
            if (bullet.isMoving()) {
                playerShootingController.calculateNewBulletPosition(bullet);
            } else {
                this.getBullets().splice(i, 1);
            }
        }
    }

    onPlayerUpdated(id, payload) {
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

        player.playerAim.angle = data.playerAim.angle;
        player.playerAim.strength = data.playerAim.strength;
    }

    onPlayerShooting(payload) {
        const data = JSON.parse(payload);

        const bullet = new Bullet(
            data.bulletId,
            data.ownerId,
            new Position(
                data.position.x,
                data.position.y,
            ),
            data.angle,
            data.velocity,
            200, // CREATE A CONST
        );

        this.getBullets().push(bullet);
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