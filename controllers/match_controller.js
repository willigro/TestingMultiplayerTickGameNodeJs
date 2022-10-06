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
const SERVER_TICK_RATE = 2;
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
        this.updateWorldState = updateWorldState;

        this.now = Date.now();
        this.lastUpdate = Date.now();

        this.initServerValues();
    }

    initServerValues() {
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
        this.intervalGameLoop = setInterval(function() {
            this.tickDeltaTime();

            while (this.server_input_msgs.length > 0) { //  && Time.time >= this.server_input_msgs.Peek().delivery_time
                const input_msg = this.server_input_msgs.dequeue();
                // console.log("server tick " + this.server_tick_number + " start tick from client " + input_msg.start_tick_number);

                // message contains an array of inputs, calculate what tick the final one is
                const max_tick = input_msg.start_tick_number + input_msg.inputs.length - 1;

                // if that tick is greater than or equal to the current tick we're on, then it
                // has inputs which are new
                if (max_tick >= this.server_tick_number) {
                    // there may be some inputs in the array that we've already had,
                    // so figure out where to start
                    const start_i = this.server_tick_number > input_msg.start_tick_number ? (this.server_tick_number - input_msg.start_tick_number) : 0;

                    // console.log("start_i=" + start_i + " input_msg.inputs.length=" + input_msg.inputs.length);
                    // run through all relevant inputs, and step player forward
                    for (var i = start_i; i < input_msg.inputs.length; ++i) {
                        const packageToSend = this.processInputs(input_msg.inputs[i], deltaTime);

                        this.server_tick_number++
                            // console.log("server_tick_number=" + server_tick_number)
                            this.server_tick_accumulator++
                            if (packageToSend && this.server_tick_accumulator >= this.server_snapshot_rate) {
                                this.server_tick_accumulator = 0;

                                packageToSend.tick = this.server_tick_number;

                                this.server_responses_queue.enqueue(packageToSend);
                            }
                    }
                }
            }

            timer += deltaTime;
            // console.log("deltaTime=" + deltaTime + " minTimeBetweenTicks=" + minTimeBetweenTicks + " timer=" + timer)
            if (timer >= minTimeBetweenTicks) {
                timer = 0;
                if (this.server_responses_queue.length > 0) {
                    // console.log(Date.now() + " " + JSON.stringify(this.server_responses_queue.first()))
                    this.updateWorldState({ response: this.server_responses_queue.toList() });
                    this.server_responses_queue.clear()
                }
            }
        }.bind(this), MAX_FPS_DELAY);
    }

    processInputs(payload, delta) {
        if (!payload) return;

        var players = payload.playerUpdate.players;

        for (var i = 0; i < players.length; i++) {
            const data = players[i];

            const player = this.getPlayerById(data.id);
            if (player) {
                player.playerMovement.angle = data.playerMovement.angle;
                player.playerMovement.strength = data.playerMovement.strength;
                player.playerMovement.velocity = data.playerMovement.velocity;
                player.setPosition(
                    playerMovementController.calculateNewPosition(
                        delta,
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

        // for (var i = 0; i < this.getBullets().length; i++) {
        //     const bullet = this.getBullets()[i];
        //     if (bullet.isMoving()) {
        //         playerShootingController.calculateNewBulletPosition(bullet);
        //     } else {
        //         this.getBullets().splice(i, 1);
        //     }
        // }

        const packgeState = {
            tick: currentTick,
            players: this.getConnectedPlayers(),
            bullets: this.getBullets()
        }

        return packgeState;
    }

    /**
     * It will handle only the send data, so I don't need to wait for more than one player
     */
    onPlayerUpdated(id, payload) {
        const data = JSON.parse(payload);
        this.server_input_msgs.enqueue(data);
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



class Queue {
    constructor() {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }
    first() {
        return this.elements[this.head];
    }
    enqueue(element) {
        this.elements[this.tail] = element;
        this.tail++;
    }
    dequeue() {
        const item = this.elements[this.head];
        delete this.elements[this.head];
        this.head++;
        return item;
    }
    clear() {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }
    peek() {
        return this.elements[this.head];
    }
    toList() {
        const arr = []
        for (var i = this.head; i < this.tail; i++) {
            arr.push(this.elements[i]);
        }
        return arr
    }
    get length() {
        return this.tail - this.head;
    }
    get isEmpty() {
        return this.length === 0;
    }
}