/**
 * Dependencies
 */
const { Player } = require('../entity/player.js');
const { PlayerAim } = require('../entity/player_aim.js');
const { Position } = require('../entity/position.js');
const { Bullet } = require('../entity/bullet.js');
const { Queue } = require('../entity/queue.js');
const { HashMapList } = require('../entity/hash_map_list.js');
const { PlayerGunPointer } = require('../entity/player_gun_pointer.js');
const { PlayerMovement } = require('../entity/player_movement.js');
const { PlayerMovementController } = require('./player_movement_controller.js');
const { PlayerShootingController } = require('./player_shooting_controller.js');
const fs = require('fs');

/**
 * Controllers
 */
const playerMovementController = new PlayerMovementController(function log(value) {
    applog(value);
});
const playerShootingController = new PlayerShootingController();

/**
 * Coneected players
 */
var connectedPlayers = [];

/**
 * Bullets
 */
var bullets = [];

/**
 * FPS variables
 */
const FPS = 5;
const MAX_FPS_DELAY = 1000 / FPS; // rollback to 30 FPS
var deltaTime = 0.0;

/**
 * Response packages variables
 */
// Amount of ticks processed necessary to send the package
const COUNT_TO_SEND = 5;

// count of ticks processed to send the package
var countToSend = 0;

/**
 * Buffer and memory
 */
// Amount of data that will be cached
const BUFFER_SIZE = 60; // calculate a size using the fps and count to send, I mean, I can calculate it as "2 seconds = FPS * 2" (only an example)

/**
 * Log
 */
var loggerList = "";
var loggerListInputs = "";

/**
 * REMOVE IT EVENTUALLY
 */
// TODO move it
const PLAYER_VELOCITY = 300.0

class MatchController {

    constructor(updateWorldState) {
        // Game loop interval
        this.intervalGameLoop = null;

        // Callback that will be used to send the package containing the world data to the clients
        this.updateWorldState = updateWorldState;

        // Values used to controll the delta
        this.now = Date.now();
        this.lastUpdate = Date.now();

        // Initialize the server variable
        this.initServerValues();
    }

    initServerValues() {
        applog("\ninitServerValues");

        // Ticks processed
        this.server_tick_number = 0;

        // Current inputs sent by the client
        this.client_inputs_map_current = new HashMapList();

        // Inputs already processed
        this.inputs_loaded_buffer = new Array(BUFFER_SIZE);

        // Simulation processed, the PRE will keep the step before the process and the POST will keep the result (PRE + Inputs)
        this.simulations_buffer_map_pre_running = new Array(BUFFER_SIZE);
        this.simulations_buffer_map_pos_running = new Array(BUFFER_SIZE);

        // It will storage the package of data to sent containing the world state
        this.world_state_response = [];

        // Controlls when stop the game (usefull for test)
        this.stopOnTick = -1;
    }

    initGame() {
        applog("\nGame started");
        this.initGameLoop();
    }

    initGameLoop() {
        this.intervalGameLoop = setInterval(function() {
            // Calculate the delta time
            this.tickDeltaTime();

            // Update the game
            this.handleTick();

            // TODO: move it
            for (var i = 0; i < this.getBullets().length; i++) {
                const bullet = this.getBullets()[i];
                if (bullet.isMoving(deltaTime)) {
                    // applog("\nMoving bullet, new size: " + this.getBullets().length);
                    playerShootingController.calculateNewBulletPosition(bullet, deltaTime);
                } else {
                    // applog("\nRemoving bullet, new size: " + this.getBullets().length);
                    this.getBullets().splice(i, 1);
                }
            }

            // When this conditional is sastified than the package will be sent
            if (countToSend >= COUNT_TO_SEND) {
                // Reset the count
                countToSend = 0;

                // Check if there is data to be sent
                if (this.world_state_response.length > 0) {
                    // Sort the response by tick
                    this.world_state_response.sort((a, b) => a.tick - b.tick);

                    // Logs
                    applog("\nsendint at tick=" + this.server_tick_number); // + " value=" + JSON.stringify(this.world_state_response)
                    for (let i in this.world_state_response) {
                        applog("\ntick=" + this.world_state_response[i].tick + " value=" + JSON.stringify(this.world_state_response[i]));
                    }

                    // Send the response
                    this.updateWorldState({ response: this.world_state_response });

                    // Clear the response
                    this.world_state_response = [];
                }
            }

            // Update the count, I'm going to update it every tick
            countToSend++;
        }.bind(this), MAX_FPS_DELAY);
    }

    handleTick() {
        // Run throught all new received inputs and get their keys, using 
        for (var k in this.client_inputs_map_current.keys) {

            // It will stop the game and save the log file
            if (this.stopOnTick != -1 && this.server_tick_number >= this.stopOnTick) {
                clearInterval(this.intervalGameLoop);
                saveFile();
            }

            // Get the current tick (the keys are the ticks)
            const inputsTick = this.client_inputs_map_current.keys[k];
            applog("\nCurrent tick=" + this.server_tick_number + " handling tick=" + inputsTick);

            // Get the message/inputs referent to the current tick
            const inputs = this.client_inputs_map_current.get(inputsTick);
            applog("\nInputs to this tick size=" + inputs.length);

            // Calculate the current buffer
            const buffer = inputsTick % BUFFER_SIZE;
            applog("\nhandle tick buffer=" + buffer + " inputs=" + JSON.stringify(inputs));

            // Case the current tick is smaller than the server tick, then do the REPLAY and if necessary the REWIND
            if (inputsTick < this.server_tick_number) {
                applog("\nMust do the replay/rewind")

                // Get the old world state referent to the current tick to do the replay
                const oldWorldStateToReplay = this.simulations_buffer_map_pre_running[buffer];

                // Check if the world state is valid and compatible with the current tick
                if (oldWorldStateToReplay && oldWorldStateToReplay.tick == inputsTick) {
                    applog("\nThe tick (inputsTick)=" + inputsTick + " have the following world state to do the replay=" + JSON.stringify(oldWorldStateToReplay));

                    // Extract the current input, it will join the all processed inputs from the current tick
                    const inputsToReplay = this.extractInputs(inputs, buffer);

                    // Make a copy of this state
                    const oldWorldStateToReplayCopy = this.copyWorldState(oldWorldStateToReplay);

                    for (let p in connectedPlayers) {
                        applog("\ntick (inputsTick)=" + inputsTick + " Old position before replay=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                    }

                    // Process the current inputs generating a new world state
                    const replayedWorldState = this.processMultipleInputs(inputsToReplay, oldWorldStateToReplayCopy, deltaTime, "replay");

                    // Check if the generated world is valid
                    if (this.isWorldStateValid(replayedWorldState)) {

                        // Update the current world state
                        this.setConnectedPlayer(replayedWorldState.players, replayedWorldState.tick);
                        this.setBullets(replayedWorldState.bullets);

                        for (let p in connectedPlayers) {
                            applog("\ntick (replayedWorldState)=" + replayedWorldState.tick + " New position (connectedPlayers) after replay=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                        }

                        // Save the processed world state
                        this.simulations_buffer_map_pos_running[buffer] = replayedWorldState;

                        applog("\nReplayed world state=" + JSON.stringify(replayedWorldState));

                        // Save the world to be sent
                        // I'm going to run throught the inputs without extraction because I wanna send only 
                        // the world referent to the current input
                        const worldToSend = this.copyWorldState(replayedWorldState);
                        // Save the world to be sent
                        for (var i in inputsToReplay) {
                            this.saveTheUpdatedWorldStateToSent(worldToSend, inputsToReplay[i]);
                        }
                    } else {
                        applog("\nWorld state is not valid (replay), tick=" + inputsTick);
                        break;
                    }

                    // Start from the next tick
                    var tickToRewind = replayedWorldState.tick + 1;

                    // Do the rewind until reach the server tick 
                    while (tickToRewind <= this.server_tick_number) {
                        applog("\nRewinding the tick=" + tickToRewind);

                        // Calculate the buffer to do the rewind
                        const bufferToRewind = tickToRewind % BUFFER_SIZE;
                        applog("\nBuffer to rewind=" + bufferToRewind);

                        // Get the inputs to rewind
                        const inputsToRewind = this.inputs_loaded_buffer[bufferToRewind];
                        applog("\nInputs to do the rewind=" + JSON.stringify(inputsToRewind));

                        // Check if the inputs are valid and compatibles
                        if (!inputsToRewind || inputsToRewind.length == 0 || inputsToRewind[0].tick != tickToRewind) {
                            applog("\nWas not found a input to rewind the tick=" + tickToRewind);
                            break;
                        }

                        // Since I'm going to rewind the world, I need to get the current world state, because the replay
                        // already replaced the world state
                        const oldWorldStateToRewind = {
                            tick: tickToRewind,
                            players: this.getConnectedPlayers(),
                            bullets: this.getBullets(),
                        };

                        applog("\nWorld state to do the rewind=" + JSON.stringify(oldWorldStateToRewind));

                        // Copy the world state
                        const oldWorldStateToRewindCopy = this.copyWorldState(oldWorldStateToRewind);

                        // Update the pre loaded world state with the current world state
                        applog("\nSaving simulation (rewind) on the buffer=" + bufferToRewind + " the tick=" + oldWorldStateToRewindCopy.tick + " world=" + JSON.stringify(oldWorldStateToRewindCopy));
                        this.simulations_buffer_map_pre_running[bufferToRewind] = this.copyWorldState(oldWorldStateToRewindCopy);

                        for (let p in connectedPlayers) {
                            applog("\ntick (oldWorldStateToRewindCopy)=" + oldWorldStateToRewindCopy.tick + " Old position before rewind=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                        }

                        // Process the inputs
                        const rewindedWorldState = this.processMultipleInputs(inputsToRewind, oldWorldStateToRewindCopy, deltaTime, "rewind");

                        // Check if the result is valid
                        if (this.isWorldStateValid(rewindedWorldState)) {

                            // Update the world                        
                            this.setConnectedPlayer(rewindedWorldState.players);
                            this.setBullets(rewindedWorldState.bullets);

                            for (let p in connectedPlayers) {
                                applog("\ntick (rewindedWorldState)=" + rewindedWorldState.tick + " New position after rewind=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                            }

                            // Update the buffer with the new world state
                            this.simulations_buffer_map_pos_running[bufferToRewind] = rewindedWorldState;

                            applog("\nRewinded world state=" + JSON.stringify(rewindedWorldState));

                            // Copy the result
                            const worldToSend = this.copyWorldState(rewindedWorldState);

                            // Save the world to be sent
                            for (var i in inputsToRewind) {
                                this.saveTheUpdatedWorldStateToSent(worldToSend, inputsToRewind[i]);
                            }

                            // Update the tick to rewind
                            tickToRewind++;
                        } else {
                            applog("\nWorld state is not valid (rewind), tick=" + inputsTick);
                            break;
                        }
                    }
                } else {
                    applog("\nThe tick=" + inputsTick + " buffer=" + buffer + " seems to be too old and there isn't any world state storaged to do the replay\n world state got=" + JSON.stringify(oldWorldStateToReplay));

                    for (let old in this.simulations_buffer_map_pre_running) {
                        if (this.simulations_buffer_map_pre_running[old])
                            applog("Simulation=" + old + " " + JSON.stringify(this.simulations_buffer_map_pre_running[old]));
                    }
                }
            } else {
                // Save the inputs used, this way I can use these inputs to do the replay and rewind later
                this.inputs_loaded_buffer[buffer] = this.copyInputs(inputs);

                // Create the current world state to save it
                const worldState = {
                    tick: this.server_tick_number,
                    players: this.getConnectedPlayers(),
                    bullets: this.getBullets(),
                }

                // Copy the values to guarantee that the reference won't be duplicated
                const copyWorldState = this.copyWorldState(worldState);

                applog("\nCurrent world state on tick=" + this.server_tick_number + " and buffer=" + buffer + " (normal)=" + JSON.stringify(copyWorldState));

                // Save the current world state
                this.simulations_buffer_map_pre_running[buffer] = copyWorldState;

                applog("\nSaving simulation (normal) on the buffer=" + buffer + " the tick=" + copyWorldState.tick);

                for (let p in connectedPlayers) {
                    applog("\ntick (normal)=" + this.server_tick_number + " Old position before normal=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                }

                // Process the current inputs
                const newWorldState = this.processMultipleInputs(inputs, this.copyWorldState(copyWorldState), deltaTime, "normal");

                // Save the new world state
                this.simulations_buffer_map_pos_running[buffer] = newWorldState;

                // Check if the result is valid
                if (this.isWorldStateValid(newWorldState)) {

                    // Update the world with the new values
                    this.setConnectedPlayer(newWorldState.players);
                    this.setBullets(newWorldState.bullets);

                    // Log
                    this.printWorldStatePositions(newWorldState, "normal")

                    // Save the world to be sent
                    for (var i in inputs) {
                        this.saveTheUpdatedWorldStateToSent(newWorldState, inputs[i]);
                    }

                    // Update the tick number
                    this.server_tick_number++;
                    applog("\nNew tick=" + this.server_tick_number);
                } else {
                    applog("\nWorld state is not valid (normal), tick=" + inputsTick);
                }
            }
        }

        this.client_inputs_map_current.clear();
    }

    extractInputs(inputs, buffer) {
        // applog("\nBuffer=" + buffer + " Input previous=" + JSON.stringify(inputs));
        const oldInputs = this.inputs_loaded_buffer[buffer];

        const inputsToProcess = [];

        for (var o in oldInputs) {
            // Add all the old inputs
            inputsToProcess.push(oldInputs[o]);
        }

        // Replace the inputs with the same playerId or add if there isn't one
        // I'm doing it because I want the newer input
        for (var i in inputs) {
            const index = inputsToProcess.findIndex(input => input.playerId == inputs[i].playerId);
            if (index == -1) {
                inputsToProcess.push(inputs[i]);
            } else {
                inputsToProcess[index] = inputs[i];
            }
        }

        // applog("\nBuffer=" + buffer + " Input after extract=" + JSON.stringify(inputsToProcess));

        return inputsToProcess;
    }

    isWorldStateValid(worldState) {
        if (worldState && worldState.players && worldState.players.length > 0) {
            for (let p in worldState.players) {
                if (!worldState.players[p]) {
                    return false;
                }
            }
        } else {
            return false
        }

        return true;
    }

    copyPlayers(players) {
        return players.map(a => (new Player(
            a.id,
            new PlayerMovement(
                new Position(a.playerMovement.position.x, a.playerMovement.position.y),
                a.playerMovement.angle,
                a.playerMovement.strength,
                a.playerMovement.velocity,
            ),
            a.playerAim, // clone it
            a.playerGunPointer, // clone it
            a.color,
        )));
    }

    copyWorldState(worldState) {
        return {
            tick: worldState.tick,
            players: this.copyPlayers(worldState.players),
            bullets: worldState.bullets, // clone it
        }
    }

    copyInputs(inputs) {
        // Create it
        return JSON.parse(JSON.stringify(inputs));
    }

    saveTheWorldStateToSent(worldState, playerId) {
        // I don't want to send more then 1 state per tick
        var canAdd = true;
        for (let i in this.world_state_response) {
            // If the world state tick already was added, then replace with the new one
            if (this.world_state_response[i].tick == worldState.tick) {
                canAdd = false
                this.world_state_response[i] = worldState;
                break;
            }
        }

        // If it was not added, so add the world state
        if (canAdd) {
            this.world_state_response.push(worldState);
        }
    }

    saveTheUpdatedWorldStateToSent(worldState, inputs) {
        applog("\n- saveTheUpdatedWorldStateToSent player=" + inputs.playerId + "  \ninput=" + JSON.stringify(inputs));
        this.printWorldStatePositions(worldState, "saveTheUpdatedWorldStateToSent");

        const player = worldState.players.find(player => player.id == inputs.playerId);

        var canAdd = true;
        for (var i in this.world_state_response) {
            const worldResponse = this.world_state_response[i];

            if (worldResponse.tick == worldState.tick) {
                canAdd = false;

                const playerIndex = worldResponse.players.findIndex(player => player.id == inputs.playerId);
                if (playerIndex == -1) {
                    worldResponse.players.push(player);
                    applog("\n- adding the player=" + inputs.playerId);
                    this.printWorldStatePositions(worldResponse, "saveTheUpdatedWorldStateToSent - adding");
                } else {
                    worldResponse.players[playerIndex] = player;
                    applog("\n- replacing the player=" + inputs.playerId);
                    this.printWorldStatePositions(worldResponse, "saveTheUpdatedWorldStateToSent - replacing");
                }
                break;
            }
        }

        if (canAdd) {
            const worldStateToSend = {
                tick: worldState.tick,
                players: [player],
                bullets: worldState.bullets,
            }
            this.world_state_response.push(worldStateToSend);

            applog("\n- pushing new world state of player=" + inputs.playerId);
            this.printWorldStatePositions(worldStateToSend, "saveTheUpdatedWorldStateToSent - pushing");
        }
    }

    isInputDuplicated(oldInputsOnBuffer, inputs) {
        if (oldInputsOnBuffer)
            for (var oldI in oldInputsOnBuffer) {
                // Check movement
                const oldPlayerMovementInputsState = oldInputsOnBuffer[oldI].playerInputsState.playerMovementInputsState;
                const playerMovementInputsState = inputs.playerInputsState.playerMovementInputsState;
                if (oldInputsOnBuffer[oldI].playerId == inputs.playerId &&
                    oldPlayerMovementInputsState.angle == playerMovementInputsState.angle &&
                    oldPlayerMovementInputsState.strength == playerMovementInputsState.strength)
                    return true
            }

        return false;
    }

    processMultipleInputs(inputList, worldState, delta, from, tick) {
        this.printWorldStatePositions(worldState, "processMultipleInputs");

        if (!inputList || !worldState) return;

        for (let index in inputList) {
            const payload = inputList[index];
            applog("\ntick (payload)= " + tick + " payload to process in multiple=" + JSON.stringify(payload));

            const playerIndex = worldState.players.findIndex(player => player.id == payload.playerId);
            const player = worldState.players[playerIndex];

            applog("\nplayer to process in multiple=" + JSON.stringify(player));

            if (player) {
                const playerMovementInputsState = payload.playerInputsState.playerMovementInputsState;
                const playerAimInputsState = payload.playerInputsState.playerAimInputsState;
                const playerGunInputsState = payload.playerInputsState.playerGunInputsState;

                player.playerMovement.angle = playerMovementInputsState.angle;
                player.playerMovement.strength = playerMovementInputsState.strength;
                player.setPosition(
                    playerMovementController.calculateNewPosition(
                        player.id,
                        from,
                        worldState.tick,
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
                //     applog("\nTry to shoot");
                // }
                // if (playerGunInputsState && payload.bulletInputsState.length > 0 && player.canShoot()) {
                //     // applog("\nshooting");
                //     const localBullet = payload.bulletInputsState[0]
                //     const bullet = new Bullet(
                //         localBullet.bulletId,
                //         localBullet.ownerId,
                //         new Position(
                //             playerGunInputsState.position.x,
                //             playerGunInputsState.position.y,
                //         ),
                //         playerGunInputsState.angle,
                //         500.0, // CREATE A CONST
                //         1000.0, // CREATE A CONST
                //     );

                //     this.getBullets().push(bullet);
                // }

                // Update world state with the updated values
                worldState.players[playerIndex] = player;
            }
        }

        // I need to copy the values because JS is not immutable and pass the things as ref
        // And I'm copying the result because I don't to change the value of the arguments (reference)
        const packgeState = {
            tick: worldState.tick,
            players: worldState.players, //this.copyPlayers(),
            bullets: worldState.bullets, // Update it, I'm updating only the players
        }

        return packgeState;
    }

    printWorldStatePositions(worldState, from) {
        for (let p in worldState.players) {
            applog("\ntick (worldState)=" + worldState.tick + " id=" + worldState.players[p].id + " from=" + from + " World state=" + JSON.stringify(worldState.players[p].playerMovement));
        }
    }

    onGameMustStop() {
        this.stopOnTick = this.server_tick_number;
    }

    /**
     * It will handle only the send data, so I don't need to wait for more than one player
     */
    onPlayerUpdated(id, payload) {
        applogInputs(JSON.stringify(payload));
        applog("\nid=" + id + " server tick=" + this.server_tick_number + " payload=" + payload);
        applog("\npayload=" + payload);

        const data = JSON.parse(payload);

        // TODO: if the hashmap works, I'll send them instead of create it here
        applog("\ndata.start_tick_number=" + data.start_tick_number);
        for (var i in data.inputs) {
            // applog(data.inputs[i]);
            this.client_inputs_map_current.put(data.inputs[i].tick, data.inputs[i]);
            applog("\ntick=" + data.inputs[i].tick + " player=" + data.inputs[i].playerId + " inputs=" + JSON.stringify(data.inputs[i].playerInputsState));
        }

        this.client_inputs_map_current.keys.sort((a, b) => a - b);

        applog("\nOrdering this.client_inputs_map_current=" + JSON.stringify(this.client_inputs_map_current));

        // applog("\nonPlayerUpdated");
        // this.inputs_buffer.print();
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
        // this.now = Date.now();
        // deltaTime = (this.now - this.lastUpdate) / 1000.0;
        // this.lastUpdate = this.now;

        deltaTime = 0.05;
    }

    getConnectedPlayers() {
        return connectedPlayers;
    }

    setConnectedPlayer(players, tick) {
        for (let p in players) {
            applog("\n- Setting on tick=" + tick + " the players= " + players[p].id + " " + JSON.stringify(players[p].playerMovement));
        }
        connectedPlayers = this.copyPlayers(players);
    }

    getBullets() {
        return bullets;
    }

    setBullets(newBullets) {
        bullets = newBullets;
    }

    generateNewPlayer(socket) {
        // const player1 = new Player(
        //     "PLAYER_1",
        //     new PlayerMovement(
        //         new Position(100, 100),
        //         0,
        //         0,
        //         PLAYER_VELOCITY,
        //     ),
        //     new PlayerAim(
        //         0,
        //         0,
        //     ),
        //     new PlayerGunPointer(
        //         new Position(0, 0),
        //         0,
        //     ),
        //     getRandomColor(),
        // );

        // const player2 = new Player(
        //     "PLAYER_2",
        //     new PlayerMovement(
        //         new Position(100, 100),
        //         0,
        //         0,
        //         PLAYER_VELOCITY,
        //     ),
        //     new PlayerAim(
        //         0,
        //         0,
        //     ),
        //     new PlayerGunPointer(
        //         new Position(0, 0),
        //         0,
        //     ),
        //     getRandomColor(),
        // );

        // connectedPlayers.push(player1, player2);
        // return { newPlayer: player1, players: connectedPlayers, tick: this.server_tick_number };


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

        this.getConnectedPlayers().push(newPlayer);

        applog("\nUser connected! " + socket.id);

        return { newPlayer: newPlayer, players: this.getConnectedPlayers(), tick: this.server_tick_number };
    }

    removePlayer(socket) {
        const index = this.getConnectedPlayers().findIndex(player => player.id == socket.id);

        if (index > -1) {
            this.getConnectedPlayers().splice(index, 1);
        }

        if (this.getConnectedPlayers().length == 0) {
            applog("\nclear interval")
            clearInterval(this.intervalGameLoop);
        }

        applog("\nPlayer Disconnected! id=" + socket.id + " Remove index " + index);
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

function applog(value) {
    // loggerList += "\n" + value;
}

function applogInputs(value) {
    loggerListInputs += value + "\n";
}

function saveFile() {
    fs.writeFile("D:\\Rittmann\\Projetos\\games\\simple card multiplayer game - server\\server\\log.txt", loggerList, function(err) {
        if (err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });

    fs.writeFile("D:\\Rittmann\\Projetos\\games\\simple card multiplayer game - server\\server\\log_input.txt", loggerListInputs, function(err) {
        if (err) {
            return console.log(err);
        }

        console.log("The file was saved (input logs)!");
    });
}