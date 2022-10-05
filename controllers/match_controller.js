const { Player } = require('../entity/player.js');
const { PlayerAim } = require('../entity/player_aim.js');
const { Position } = require('../entity/position.js');
const { Bullet } = require('../entity/bullet.js');
const { PlayerMovement } = require('../entity/player_movement.js');
const { ServerPayload } = require('../entity/server_payload.js');
const { PlayerMovementController } = require('./player_movement_controller.js');
const { PlayerShootingController } = require('./player_shooting_controller.js');
/**
 * Coneected players
 */
var connectedPlayers = [];

var bullets = [];

const playerMovementController = new PlayerMovementController();
const playerShootingController = new PlayerShootingController();

const FPS = 30;
const UPDATER_TICKS = 1;
const MAX_FPS_DELAY = 1000 / FPS; // rollback to 30 FPS
const MAX_UPDATER_TICKS_DELAY = 1000 / UPDATER_TICKS; // rollback to 30 FPS

// TODO move it
const PLAYER_VELOCITY = 300.0

// KEEP IT EQUALS TO THE APP
const SERVER_TICK_RATE = 5;
const BUFFER_SIZE = 1024;
var timer = 0;
var currentTick = 0;
var minTimeBetweenTicks = 1 / SERVER_TICK_RATE;

var deltaTime = 0.0;

var stateBuffer = new Array(BUFFER_SIZE)
var inputQueue = [];

class MatchController {

    constructor(updateWorldState) {
        this.intervalGameLoop = null;
        this.intervalGameWorldStateUpdater = null;
        this.updateWorldState = updateWorldState;
        this.packgeState = null;

        this.now = Date.now();
        this.lastUpdate = Date.now();
    }

    initGame() {
        currentTick = 0;

        this.initGameLoop();

        this.initGameLoopUpdater();
    }

    initGameLoop() {
        this.intervalGameLoop = setInterval(function() {
            this.tickDeltaTime();
            this.handleTick();
            this.update();
            // console.log(currentTick);
            currentTick++;

            // I don't want to send on evey update
            timer += deltaTime;
            // console.log("deltaTime=" + deltaTime + " minTimeBetweenTicks=" + minTimeBetweenTicks + " timer=" + timer)
            if (timer >= minTimeBetweenTicks) {
                timer = 0;

                if (this.getConnectedPlayers().length > 0)
                    console.log("At tick=" + currentTick + " TO CLIENT" + JSON.stringify(this.getConnectedPlayers()[0].playerMovement) + "\n");

                // for a while I don't to control it. I'll send to everyone even without updates
                const bufferIndex = 1
                if (bufferIndex != -1) {
                    this.packgeState = {
                        tick: currentTick,
                        players: this.getConnectedPlayers(),
                        bullets: this.getBullets()
                    }
                    this.updateWorldState(this.packgeState);
                }
            }
        }.bind(this), MAX_FPS_DELAY);
    }

    initGameLoopUpdater() {
        // this.intervalGameWorldStateUpdater = setInterval(function() {
        //     // if (this.packgeState) {
        //     //     this.updateWorldState(this.packgeState);

        //     //     this.packgeState = null;
        //     // }
        //     // this.handleTick();
        //     // currentTick++;

        //     // timer += deltaTime;
        //     // // console.log("Timer " + timer);
        //     // while (timer >= minTimeBetweenTicks) {
        //     //     timer -= minTimeBetweenTicks;
        //     //     this.handleTick();
        //     //     currentTick++;
        //     // }
        // }.bind(this), MAX_UPDATER_TICKS_DELAY);
    }

    handleTick() {
        // console.log("CurrentTick " + currentTick);

        // Process the input queue
        var bufferIndex = -1;
        var inputPayload
        var statePayload
            // console.log(inputQueue)
        while (inputQueue.length > 0) {
            inputPayload = inputQueue.shift();
            // console.log("inputPayload=" + inputPayload.tick)
            bufferIndex = inputPayload.tick % BUFFER_SIZE;

            statePayload = this.processInputs(inputPayload)
            stateBuffer[bufferIndex] = statePayload;
        }

        // console.log("bufferIndex " + bufferIndex);
        // console.log("stateBuffer " + stateBuffer);

        // return bufferIndex;
        // if (!inputPayload) return null;

        // return inputPayload.tick;
    }

    processInputs(inputPayload) {
        var players = inputPayload.payload.playerUpdate.players;

        for (var i = 0; i < players.length; i++) {
            const data = players[i];

            const player = this.getPlayerById(data.id);
            if (player) {
                player.playerMovement.angle = data.playerMovement.angle;
                player.playerMovement.strength = data.playerMovement.strength;
                player.playerMovement.velocity = data.playerMovement.velocity;
                player.setPosition(
                    playerMovementController.calculateNewPosition(
                        deltaTime,
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
        }

        // this.packgeState = {
        //     tick: currentTick,
        //     players: this.getConnectedPlayers(),
        //     bullets: this.getBullets()
        // }

        // return this.packgeState;
    }

    update() {
        for (var i = 0; i < this.getConnectedPlayers().length; i++) {
            const player = this.getConnectedPlayers()[i];
            if (player.isMoving()) {
                player.setPosition(
                    playerMovementController.calculateNewPosition(
                        deltaTime,
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
            if (bullet.isMoving()) {
                playerShootingController.calculateNewBulletPosition(bullet);
            } else {
                this.getBullets().splice(i, 1);
            }
        }
    }

    /**
     * It will handle only the send data, so I don't need to wait for more than one player
     */
    onPlayerUpdated(id, payload) {
        var player = this.getPlayerById(id);
        if (!player) {
            console.log("PLAYER SERVER NOT FOUND " + player);
            return;
        }

        const data = JSON.parse(payload);

        if (data.playerUpdate.players.length == 0) {
            console.log("PLAYER CLIENT NOT FOUND " + player);
            return;
        }

        console.log("At tick=" + currentTick + " FROM CLIENT " + JSON.stringify(data.playerUpdate.players[0].playerMovement))

        const serverPayload = new ServerPayload(
            data.tick,
            data,
        );

        inputQueue.push(serverPayload)

        // console.log("Tick app + " + payload.tick + " tick server " + this.currentTick);

        // console.log("Data position " + data.playerMovement.position.x + " player server position " + player.playerMovement.position.x);

        // console.log(id);
        // console.log(payload);
        // console.log(player);
        // console.log(this.getConnectedPlayers());

        // console.log(
        //     "Player Server position " + JSON.stringify(player.playerMovement.position) +
        //     " Payload position " + JSON.stringify(data.playerMovement.position)
        // );
        // console.log(data)

        /*
        TODO: I can't get the position and change the player position here
        I need to save in a queue all the requests and process them comparing to the position
        calculated on the server update
        */

        // player.playerMovement.angle = data.playerMovement.angle;
        // player.playerMovement.strength = data.playerMovement.strength;
        // player.playerMovement.velocity = data.playerMovement.velocity;
        // player.setPosition(
        //     playerMovementController.calculateNewPosition(
        //         deltaTime,
        //         data.playerMovement.angle,
        //         data.playerMovement.strength,
        //         player.playerMovement.position.x,
        //         player.playerMovement.position.y,
        //         data.playerMovement.velocity,
        //     )
        // );
        // player.playerAim.angle = data.playerAim.angle;
        // player.playerAim.strength = data.playerAim.strength;
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
            500.0, // CREATE A CONST
        );

        this.getBullets().push(bullet);
    }

    tickDeltaTime() {
        this.now = Date.now();
        deltaTime = (this.now - this.lastUpdate) / 1000.0;
        // console.log("Now " + this.now + " Last " + this.lastUpdate + " Non parse " + (this.now - this.lastUpdate) + " delta " + deltaTime)
        this.lastUpdate = this.now;
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

        // console.log(newPlayer)

        this.getConnectedPlayers().push(newPlayer);

        console.log("User connected! " + socket.id + " players " + JSON.stringify(this.getConnectedPlayers()));

        return { newPlayer: newPlayer, players: this.getConnectedPlayers(), tick: currentTick };
    }

    removePlayer(socket) {
        console.log("Player Disconnected! " + socket.id + " players " + JSON.stringify(this.getConnectedPlayers()));
        const index = this.getConnectedPlayers().findIndex(player => player.id == socket.id);
        if (index > -1) {
            this.getConnectedPlayers().splice(index, 1);
        }
        console.log("Player Disconnected! Remove index " + index + " players " + JSON.stringify(this.getConnectedPlayers()));
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