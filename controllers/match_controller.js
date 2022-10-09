const { Player } = require('../entity/player.js');
const { PlayerAim } = require('../entity/player_aim.js');
const { Position } = require('../entity/position.js');
const { Bullet } = require('../entity/bullet.js');
const { Queue } = require('../entity/queue.js');
const { PlayerGunPointer } = require('../entity/player_gun_pointer.js');
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

const FPS = 15;
const MAX_FPS_DELAY = 1000 / FPS; // rollback to 30 FPS

// TODO move it
const PLAYER_VELOCITY = 300.0

// KEEP IT EQUALS TO THE APP
const SERVER_TICK_RATE = 5;
var timer = 0;
var currentTick = 0;
var minTimeBetweenTicks = 1 / SERVER_TICK_RATE;

var deltaTime = 0.0;

class MatchController {

    constructor(updateWorldState) {
        this.intervalGameLoop = null;
        this.updateWorldState = updateWorldState;

        this.now = Date.now();
        this.lastUpdate = Date.now();

        this.initServerValues();
    }

    initServerValues() {
        console.log("initServerValues");
        // server specific
        this.server_snapshot_rate = 0;
        this.server_tick_number = 0;
        this.server_tick_accumulator = 0;
        this.server_input_msgs = new Queue();
        this.server_responses_queue = new Queue();
    }

    initGame() {
        currentTick = 0;

        this.initServerValues();

        this.initGameLoop();
    }

    initGameLoop() {
        var localTick = 0
        this.intervalGameLoop = setInterval(function() {
            this.tickDeltaTime();
            while (this.server_input_msgs.length > 0) { //  && Time.time >= this.server_input_msgs.Peek().delivery_time
                const input_msg = this.server_input_msgs.dequeue();
                // console.log("server tick " + this.server_tick_number + " start tick from client " + input_msg.start_tick_number);

                // message contains an array of inputs, calculate what tick the final one is
                const max_tick = input_msg.start_tick_number + input_msg.inputs.length - 1;

                // console.log("this.server_tick_number=" + this.server_tick_number + " max_tick=" + max_tick);
                // if that tick is greater than or equal to the current tick we're on, then it
                // has inputs which are new
                if (max_tick >= this.server_tick_number) {
                    // there may be some inputs in the array that we've already had,
                    // so figure out where to start
                    const start_i = this.server_tick_number > input_msg.start_tick_number ? (this.server_tick_number - input_msg.start_tick_number) : 0;

                    // console.log("start_i=" + start_i + " input_msg.inputs.length=" + input_msg.inputs.length);
                    // run through all relevant inputs, and step player forward
                    // console.log("Tick=" + input_msg.start_tick_number + " size=" + input_msg.inputs.length)
                    for (var i = start_i; i < input_msg.inputs.length; ++i) {
                        const packageToSend = this.processInputs(input_msg.inputs[i], deltaTime);

                        this.server_tick_number++;
                        // console.log("server_tick_number=" + server_tick_number)
                        this.server_tick_accumulator++;
                        if (packageToSend && this.server_tick_accumulator >= this.server_snapshot_rate) {
                            this.server_tick_accumulator = 0;

                            packageToSend.tick = this.server_tick_number;

                            // if (packageToSend.bullets.length > 0) {
                            //     console.log(packageToSend.tick);
                            // }

                            this.server_responses_queue.enqueue(packageToSend);
                        }
                    }
                }
            }

            // if (this.getBullets().length > 0) {
            //     console.log(this.getBullets().length)
            // }
            for (var i = 0; i < this.getBullets().length; i++) {
                const bullet = this.getBullets()[i];
                if (bullet.isMoving(deltaTime)) {
                    // console.log("Moving bullet, new size: " + this.getBullets().length);
                    playerShootingController.calculateNewBulletPosition(bullet, deltaTime);
                } else {
                    // console.log("Removing bullet, new size: " + this.getBullets().length);
                    this.getBullets().splice(i, 1);
                }
            }

            timer += deltaTime;
            // console.log("deltaTime=" + deltaTime + " minTimeBetweenTicks=" + minTimeBetweenTicks + " timer=" + timer)
            if (timer >= minTimeBetweenTicks) {
                timer = 0;
                if (this.server_responses_queue.length > 0) {
                    // console.log(Date.now() + " " + JSON.stringify(this.server_responses_queue.first()))
                    // const list = this.server_responses_queue.toList()
                    // for (var item in list) {
                    //     if (list[item].bullets.length > 0)
                    //         console.log(list[item].bullets)
                    // }
                    this.updateWorldState({ response: this.server_responses_queue.toList() });
                    this.server_responses_queue.clear()
                }
            }

            localTick++;
        }.bind(this), MAX_FPS_DELAY);
    }

    processInputs(payload, delta) {
        if (!payload) return;

        const playerMovementInputsState = payload.playerInputsState.playerMovementInputsState;
        const playerAimInputsState = payload.playerInputsState.playerAimInputsState;
        const playerGunInputsState = payload.playerInputsState.playerGunInputsState;

        const player = this.getPlayerById(payload.playerId);

        if (player) {
            player.playerMovement.angle = playerMovementInputsState.angle;
            player.playerMovement.strength = playerMovementInputsState.strength;
            player.setPosition(
                playerMovementController.calculateNewPosition(
                    delta,
                    playerMovementInputsState.angle,
                    playerMovementInputsState.strength,
                    player.playerMovement.position.x,
                    player.playerMovement.position.y,
                    player.playerMovement.velocity,
                )
            );
            player.playerAim.angle = playerAimInputsState.angle;
            player.playerAim.strength = playerAimInputsState.strength;
            player.playerGunPointer.position.x = playerGunInputsState.position.x;
            player.playerGunPointer.position.y = playerGunInputsState.position.y;

            // For a while, if the player request two shoots together, but the player cannot shoot it
            // I'm going to cancel the last one, I'm going to get only the first bullet
            // TODO: later I wanna to schedule the shoots, or if it is a problem, I'm going to check
            //       if the player can shoot using the TICK and time, it means that, if the first
            //       shoot was trigger at the tick 1 and the second one was the tick 3, and I have
            //       to wait a time X that is, for convenience, the same as the 1 tick, then I'll shoot again
            //       cause the first was at the tick 1, and at the tick 2 I'll skip and at the tick 3, the time
            //       has passed and I can shoot again.
            // if (payload.bulletInputsState.length > 0) {
            //     console.log("Try to shoot");
            // }
            if (playerGunInputsState && payload.bulletInputsState.length > 0 && player.canShoot()) {
                // console.log("shooting");
                const localBullet = payload.bulletInputsState[0]
                const bullet = new Bullet(
                    localBullet.bulletId,
                    localBullet.ownerId,
                    new Position(
                        playerGunInputsState.position.x,
                        playerGunInputsState.position.y,
                    ),
                    playerGunInputsState.angle,
                    500.0, // CREATE A CONST
                    1000.0, // CREATE A CONST
                );

                this.getBullets().push(bullet);
            }
        }

        const packgeState = {
            tick: currentTick,
            players: this.getConnectedPlayers(),
            bullets: this.getBullets(),
        }

        // if (this.getBullets().length > 0)
        //     console.log(this.getBullets())

        return packgeState;
    }

    /**
     * It will handle only the send data, so I don't need to wait for more than one player
     */
    onPlayerUpdated(id, payload) {
        const data = JSON.parse(payload);
        // console.log(data)
        this.server_input_msgs.enqueue(data);
    }

    onPlayerShooting(payload) {
        // Added this payload to the inputs
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
            new PlayerGunPointer(
                new Position(0, 0),
                0,
            ),
            getRandomColor(),
        );

        // console.log(newPlayer)

        this.getConnectedPlayers().push(newPlayer);

        //+ " players " + JSON.stringify(this.getConnectedPlayers())
        console.log("User connected! " + socket.id);

        return { newPlayer: newPlayer, players: this.getConnectedPlayers(), tick: currentTick };
    }

    removePlayer(socket) {
        const index = this.getConnectedPlayers().findIndex(player => player.id == socket.id);

        if (index > -1) {
            this.getConnectedPlayers().splice(index, 1);
        }

        if (this.getConnectedPlayers().length == 0) {
            console.log("clear interval")
            clearInterval(this.intervalGameLoop);
        }

        // + " players " + JSON.stringify(this.getConnectedPlayers())
        console.log("Player Disconnected! id=" + socket.id + " Remove index " + index);
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