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
 * Coneected players
 */
var connectedPlayers = [];

var bullets = [];

const playerMovementController = new PlayerMovementController(function log(value) {
    applog(value);
});
const playerShootingController = new PlayerShootingController();

const FPS = 5;
const MAX_FPS_DELAY = 1000 / FPS; // rollback to 30 FPS

// TODO move it
const PLAYER_VELOCITY = 300.0

// KEEP IT EQUALS TO THE APP
const SERVER_TICK_RATE = 4;
const COUNT_TO_SEND = 5;
var timer = 0;
var minTimeBetweenTicks = 1 / SERVER_TICK_RATE;
var countToSend = 2;

var deltaTime = 0.0;

const BUFFER_SIZE = 20;

var loggerList = "";

class MatchController {

    constructor(updateWorldState) {
        this.intervalGameLoop = null;
        this.updateWorldState = updateWorldState;

        this.now = Date.now();
        this.lastUpdate = Date.now();

        this.initServerValues();
    }

    initServerValues() {
        applog("\ninitServerValues");
        // server specific
        this.server_snapshot_rate = 0;
        this.server_tick_number = 0;
        this.server_tick_accumulator = 0;
        this.server_input_msgs = new Queue();
        // this.server_responses_queue = new Queue();
        this.server_responses_map = new Map();
        this.client_inputs_map_current = new HashMapList();

        // this.inputs_buffer_map_old = new HashMapList(BUFFER_SIZE);
        this.inputs_buffer_map_old = new Array(BUFFER_SIZE);
        this.inputs_buffer_map_old_secondary = new Array(BUFFER_SIZE);
        this.simulations_buffer_map_old = new Queue(BUFFER_SIZE);
        this.world_state_response = [];

        this.stopOnTick = -1;
    }

    initGame() {
        applog("\nGame started");
        this.initGameLoop();
    }

    initGameLoop() {
        this.intervalGameLoop = setInterval(function() {
            this.tickDeltaTime();
            // this.handleTick();
            this.handleTickDouble();

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

            // applog("\ncountToSend=" + countToSend + " COUNT_TO_SEND=" + COUNT_TO_SEND + " this.world_state_response.length=" + this.world_state_response.length);
            timer += deltaTime;
            if (countToSend >= COUNT_TO_SEND) {
                timer = 0;
                countToSend = 0;

                if (this.world_state_response.length > 0) {
                    // Sort the response by tick
                    this.world_state_response.sort((a, b) => a.tick - b.tick);
                    // applog("\nReponse=" + JSON.stringify(this.world_state_response));

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
            countToSend++;


            if (this.server_tick_number == 10) {
                clearImmediate(this.intervalGameLoop);
            }
        }.bind(this), MAX_FPS_DELAY);
    }

    // handleTick() {
    //     // applog("\nbefore size=" + this.map.map.size + " isNotEmpty=" + this.map.isNotEmpty());
    //     // I'm checking if it is not empty because I guess that the map can receive more data while it's processing
    //     while (this.client_inputs_map_current.isNotEmpty()) {
    //         for (var key in this.client_inputs_map_current.keys) {
    //             const messagesByTick = this.client_inputs_map_current.get(this.client_inputs_map_current.keys[key]);
    //             // applog(messagesByTick);

    //             for (var mI in messagesByTick) {
    //                 // applog(
    //                 //     "currentTick=" + this.server_tick_number +
    //                 //     " payloadTick=" + messagesByTick[mI].tick +
    //                 //     " playerId=" + messagesByTick[mI].playerId
    //                 // );

    //                 const packageToSend = this.processInputs(messagesByTick[mI], deltaTime);

    //                 this.server_tick_accumulator++;
    //                 if (packageToSend && this.server_tick_accumulator >= this.server_snapshot_rate) {
    //                     this.server_tick_accumulator = 0;

    //                     packageToSend.tick = this.server_tick_number;

    //                     // if (packageToSend.bullets.length > 0) {
    //                     //     applog(packageToSend.tick);
    //                     // }

    //                     // this.server_responses_queue.enqueue(packageToSend);

    //                     this.server_responses_map.set(this.server_tick_number, packageToSend);
    //                 }
    //             }

    //             // TODO it is smelling like shit
    //             // without it the server will always be ahead the client, and I still could
    //             // not control properly the old inputs, so I'm forcing it to see how it can be at the end
    //             if (this.client_inputs_map_current.keys[key] > this.server_tick_number) {
    //                 this.server_tick_number++;
    //             }
    //             this.client_inputs_map_current.delete(this.client_inputs_map_current.keys[key]);
    //         }
    //     }
    //     // this.map.clear();
    //     // applog("\nafter size=" + this.map.map.size);
    // }

    // What is lecking here is treat the inputs on rewind that are getting only one inputs and not both
    // because only one input was added
    // It was working fine to the second player (the input that was got when I was doing the rewind), but as the 
    // second input was not added to the list, it was getting wrong
    // handleTick() {
    //     // Run throught all new received inputs and get their keys, using 
    //     for (var k in this.client_inputs_map_current.keys) {

    //         // Get the current key, the keys are the TICK
    //         const key = this.client_inputs_map_current.keys[k];
    //         applog("\nCurrent tick=" + this.server_tick_number + " handling key=" + key);

    //         // Get the message/inputs referent to the current key/tick
    //         const inputsByTick = this.client_inputs_map_current.get(key);
    //         applog("\nInputs to this key size=" + inputsByTick.length);

    //         var canIncreaseTick = false;

    //         // Read all the inputs of the tick
    //         for (var iT in inputsByTick) {

    //             // Current inputs
    //             const inputs = inputsByTick[iT];

    //             // Get the buffer referent to the input's tick, if the buffer_size is 10 and the tick is 
    //             // 11, the result will be 1
    //             const buffer = inputs.tick % BUFFER_SIZE;
    //             applog("\nhandle tick buffer=" + buffer + " inputs=" + JSON.stringify(inputs));

    //             // Get the old inputs referent to this buffer, It will not guarantee that the inputs are
    //             // referent to the current tick, so I'll need to confirme it
    //             // [seing it later] By what I can see I'm made it to test the inputs of the current tick was already processed
    //             const oldInputsOnBuffer = this.inputs_buffer_map_old[buffer];

    //             applog("\noldInputsOnBuffer=" + JSON.stringify(oldInputsOnBuffer));
    //             if (inputs.tick < this.server_tick_number ||
    //                 (oldInputsOnBuffer && oldInputsOnBuffer.length > 0 && oldInputsOnBuffer[0].tick == inputs.tick)) {

    //                 // If already exists an inputs equals to the new one, I can ignore it
    //                 // Since it was find at the same tick it means that it was sent duplicated
    //                 // I cannot handle something like goes to the same position twice at the same tick!
    //                 if (this.isInputDuplicated(oldInputsOnBuffer, inputs)) {
    //                     applog("\nIgnore the current input cause it is duplicated");
    //                     continue;
    //                 }

    //                 applog("\nThe inputs tick was already added");

    //                 // Add the new inputs to the old ones and save it
    //                 this.registerOldInputs(inputs);

    //                 // Get the inputs again after the register, because it could be overrided
    //                 const oldInputs = this.inputs_buffer_map_old[buffer];
    //                 applog("\nOn replay oldInputs (confirming the inputs selected)=" + JSON.stringify(oldInputs));

    //                 // Get the old world state, I'll use it to make the replay
    //                 const oldWorldState = this.simulations_buffer_map_old[buffer];

    //                 applog("\nOld world state to replay=" + JSON.stringify(oldWorldState));

    //                 // Process the inputs doing a replay
    //                 const replayedWorldState = this.processMultipleInputs(oldInputs, this.copyWorldState(oldWorldState), deltaTime, "replay");
    //                 applog("\nReplayed world state=" + JSON.stringify(replayedWorldState));

    //                 if (replayedWorldState) {
    //                     // Set the connected players and the bullets with the "new" state
    //                     this.setConnectedPlayer(this.copyPlayers(replayedWorldState.players));
    //                     this.setBullets(replayedWorldState.bullets);

    //                     // // Save the replayed world state
    //                     // this.simulations_buffer_map_old[buffer] = replayedWorldState

    //                     // Save the world to be sent
    //                     // replayedWorldState.tick = replayedWorldState.tick + 1;
    //                     applog("\nReplayed world state after adjust=" + JSON.stringify(replayedWorldState));
    //                     applog("\nOld world state after replay (on buffer)=" + JSON.stringify(this.simulations_buffer_map_old[buffer]));
    //                     for (var oI in oldInputs) {
    //                         this.saveTheUpdatedWorldStateToSent(replayedWorldState, oldInputs[oI]);
    //                     }

    //                     // Rewind the world state until the current tick on server
    //                     applog("\nserver tick=" + this.server_tick_number + " current tick=" + inputs.tick);

    //                     // Starting on the next tick, rewind the world
    //                     var replayAndRewindTick = inputs.tick + 1;
    //                     while (replayAndRewindTick < this.server_tick_number) {
    //                         applog("\nReplay and Rewind=" + replayAndRewindTick);
    //                         const rrBuffer = replayAndRewindTick % BUFFER_SIZE;

    //                         // Get the inputs
    //                         const oldInputsRewind = this.inputs_buffer_map_old[rrBuffer];

    //                         if (!oldInputsRewind || oldInputsRewind.length == 0 || oldInputsRewind[0].tick != replayAndRewindTick) {
    //                             applog("\ncannot rewind the tick=" + replayAndRewindTick + ", no one inputs was found");
    //                             break;
    //                         }

    //                         // Build the current world state
    //                         const currentWorldState = {
    //                             tick: replayAndRewindTick,
    //                             players: this.getConnectedPlayers(),
    //                             bullets: this.getBullets(),
    //                         }

    //                         const copyCurrentWorldState = this.copyWorldState(currentWorldState)

    //                         applog("\nCurrent world state to rewind=" + JSON.stringify(copyCurrentWorldState));

    //                         // // Save the current world state
    //                         // this.simulations_buffer_map_old[rrBuffer] = copyCurrentWorldState;

    //                         // Get the old world state, I'll use it to make the replay
    //                         // const oldWorldState = this.simulations_buffer_map_old[rrBuffer];

    //                         // Process the inputs doing a replay and using the new current world state
    //                         // I'm doing it because the world could be changed after the replay
    //                         const rewindedWorldState = this.processMultipleInputs(oldInputsRewind, copyCurrentWorldState, deltaTime, "rewind");

    //                         if (rewindedWorldState) {
    //                             // Set the connected players and the bullets with the "new" state
    //                             this.setConnectedPlayer(this.copyPlayers(rewindedWorldState.players));
    //                             this.setBullets(rewindedWorldState.bullets);

    //                             applog2("\ntick (replayAndRewindTick)=" + replayAndRewindTick + " New players after rewind=" + JSON.stringify(connectedPlayers));

    //                             applog("\nRewinded world state=" + JSON.stringify(rewindedWorldState));

    //                             // Save the world to be sent
    //                             // rewindedWorldState.tick = rewindedWorldState.tick + 1;
    //                             applog("\nRewinded world state after adjust=" + JSON.stringify(rewindedWorldState));
    //                             applog("\nRewind=" + JSON.stringify(oldInputsRewind));
    //                             for (var oI in oldInputsRewind) {
    //                                 this.saveTheUpdatedWorldStateToSent(rewindedWorldState, oldInputsRewind[oI]);
    //                             }

    //                             // Save the replayed world state
    //                             // this.simulations_buffer_map_old[rrBuffer] = replayedWorldState

    //                             // Rewind the world state until the current tick on server
    //                             applog("\nserver tick=" + this.server_tick_number + " current tick=" + replayAndRewindTick);
    //                         }

    //                         replayAndRewindTick++;
    //                     }
    //                 }
    //             } else {
    //                 // Increase the server tick cause a new state will be created
    //                 // this.server_tick_number++;

    //                 applog("\nThe inputs was NOT added the the list");

    //                 // WHY DID I MAKE IT?
    //                 // Register this inputs
    //                 this.registerOldInputs(inputs);

    //                 // Save the world state, this way I can use different inputs in this state and generate new worlds
    //                 const worldState = {
    //                     tick: this.server_tick_number,
    //                     players: this.getConnectedPlayers(),
    //                     bullets: this.getBullets(),
    //                 }

    //                 const copyWorldState = this.copyWorldState(worldState);

    //                 applog("\nCurrent world state=" + JSON.stringify(copyWorldState));

    //                 this.simulations_buffer_map_old[buffer] = copyWorldState;

    //                 // Process the current inputs
    //                 const newWorldState = this.processInputs(inputs, this.copyWorldState(copyWorldState), deltaTime);

    //                 // Update the world
    //                 this.setConnectedPlayer(this.copyPlayers(newWorldState.players));
    //                 this.setBullets(newWorldState.bullets);

    //                 applog("\nNew world state=" + JSON.stringify(newWorldState));
    //                 applog("\nNew world state 2=" + JSON.stringify(copyWorldState));

    //                 // remove it
    //                 const worldStateAfterEvaluate = {
    //                     tick: this.server_tick_number,
    //                     players: this.getConnectedPlayers(),
    //                     bullets: this.getBullets(),
    //                 }

    //                 applog("\nNew world state 3 (after evaluate)=" + JSON.stringify(worldStateAfterEvaluate));

    //                 // Save the world to be sent
    //                 this.saveTheUpdatedWorldStateToSent(newWorldState, inputs);

    //                 // Save the new world state
    //                 // this.simulations_buffer_map_old[buffer] = worldState;

    //                 canIncreaseTick = true;
    //             }
    //         }

    //         if (canIncreaseTick) {
    //             this.server_tick_number++;
    //         }
    //         applog("\nNew tick=" + this.server_tick_number);
    //     }

    //     this.client_inputs_map_current.clear();
    // }

    /* 
    Here we go again
    
    - As the inputs will be together in the same list, I'm going to run through all items (ticks)
    - Get the inputs of the current tick (usually 2 or 1 (often 2))
    - Check if the the tick is smaller than the server tick, if it is
        - yes -> do the replay, rewind
            - Replay -
            - Rewind ->
        - no -> keep going normal
    - Save the current world state to do the replay/rewind later
    - Process the world with both the inputs (often 2)
    - Register the inputs as an old, but in a different list (I don't want to change the handleTick() because I'll use as reference even it wasn't working)
    - Register the results to send
    */
    handleTickDouble() {
        // Run throught all new received inputs and get their keys, using 
        for (var k in this.client_inputs_map_current.keys) {

            if (this.stopOnTick != -1 && this.server_tick_number >= this.stopOnTick) {
                clearInterval(this.intervalGameLoop);
                saveFile();
            }

            // Get the current key, the keys are the TICK
            const key = this.client_inputs_map_current.keys[k];
            applog("\nCurrent tick=" + this.server_tick_number + " handling key=" + key);

            // Get the message/inputs referent to the current key/tick
            const inputs = this.client_inputs_map_current.get(key);
            applog("\nInputs to this key size=" + inputs.length);

            // Get the tick of the inputs
            const inputsTick = key;
            applog("\nCurrent tick to handle=" + inputsTick);

            // Get the buffer referent to the input's tick, if the buffer_size is 10 and the tick is 
            // 11, the result will be 1
            const buffer = inputsTick % BUFFER_SIZE;
            applog2("\nhandle tick buffer=" + buffer + " inputs=" + JSON.stringify(inputs));

            if (inputsTick < this.server_tick_number) {
                applog("\nMust do the replay/rewind")

                // Get the old world state referent to the current tick to do the replay
                const oldWorldStateToReplay = this.simulations_buffer_map_old[buffer];

                // Check if the world state is valid and compatible with the current tick
                if (oldWorldStateToReplay && oldWorldStateToReplay.tick == inputsTick) {
                    applog2("\nThe tick (inputsTick)=" + inputsTick + " have the following world state to do the replay=" + JSON.stringify(oldWorldStateToReplay));

                    const inputsToReplay = this.extractInputs(inputs, buffer);

                    // Make a copy of this state to not change this values through reference
                    const oldWorldStateToReplayCopy = this.copyWorldState(oldWorldStateToReplay);

                    for (let p in connectedPlayers) {
                        applog2("\ntick (inputsTick)=" + inputsTick + " Old position before replay=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                    }

                    // Process the current inputs
                    const replayedWorldState = this.processMultipleInputs(inputsToReplay, oldWorldStateToReplayCopy, deltaTime, "replay");

                    if (this.isWorldStateValid(replayedWorldState)) {
                        // Update the world
                        // I'm going to do that because the updates must affect the current world and the replay and rewind must go
                        // until the current world state

                        this.setConnectedPlayer(this.copyPlayers(replayedWorldState.players), replayedWorldState.tick);
                        this.setBullets(replayedWorldState.bullets);

                        for (let p in connectedPlayers) {
                            applog2("\ntick (replayedWorldState)=" + replayedWorldState.tick + " New position (connectedPlayers) after replay=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                        }

                        // Update the next old world state, since it is the new state of it
                        // Increase the tick to storage at the next buffer
                        replayedWorldState.tick++;
                        const nBuffer = replayedWorldState.tick % BUFFER_SIZE;
                        this.simulations_buffer_map_old[nBuffer] = replayedWorldState;

                        applog("\nReplayed world state after increase tick=" + JSON.stringify(replayedWorldState));

                        // Save the world to be sent
                        // I'm going to run throught the inputs without extraction because I wanna to send only 
                        // The world referent to the main input (the extract is join the inputs of the same tick)
                        // The app will calculate with the result of result of the tick, but using the POST list, same tick, but the result
                        const worldToSend = this.copyWorldState(replayedWorldState);
                        worldToSend.tick -= 1;
                        // Save the world to be sent
                        for (var i in inputsToReplay) {
                            this.saveTheUpdatedWorldStateToSent(worldToSend, inputsToReplay[i]);
                        }
                    } else {
                        applog("\nWorld state is not valid (replay), tick=" + inputsTick);
                        break;
                    }

                    /*
                     Now I need to do the rewind from the the next buffer/tick until the current buffer/tick on server
                     
                     This is an example of the sequence of inputs, it went until 470 in sequence. 
                     From this I can say that the rewind could not be useful, but what if the current tick is 470 and I don't 
                     have the inputs to the 470, I could not do the rewind and something could goes wrong, so I'm going to 
                     force the rewind to test the result

                     Current tick=470 handling key=467
                     Inputs to this key size=1
                     Must do the replay/rewind

                     Current tick=470 handling key=468
                     Inputs to this key size=1
                     Must do the replay/rewind
                    */

                    // Start from the next tick
                    var tickToRewind = replayedWorldState.tick;

                    // Do the rewind until reach the server tick 
                    while (tickToRewind <= this.server_tick_number) {
                        applog("\nRewinding the tick=" + tickToRewind);

                        // Calculate the buffer to do the rewind
                        const bufferToRewind = tickToRewind % BUFFER_SIZE;
                        applog("\nBuffer to rewind=" + bufferToRewind);

                        // Get the inputs to rewind
                        const inputsToRewind = this.inputs_buffer_map_old_secondary[bufferToRewind];
                        applog("\nInputs to do the rewind=" + JSON.stringify(inputsToRewind));

                        // Check if the inputs is valid and compatible
                        if (!inputsToRewind || inputsToRewind.length == 0 || inputsToRewind[0].tick != tickToRewind) {
                            applog("\nWas not found a input to rewind the tick=" + tickToRewind);
                            break;
                            // // Try to get an input on the list of new inputs, cause it can do the replay even before
                            // // of this input be saved
                            // inputsToRewind = this.client_inputs_map_current.get(tickToRewind);

                            // // Check if the inputs is valid and compatible
                            // if (!inputsToRewind || inputsToRewind.length == 0 || inputsToRewind[0].tick != tickToRewind) {

                            //     applog("\nTried to find a input on the list of new inputs but was not found a input to rewind the tick=" + tickToRewind);
                            //     break;
                            // }

                            // applog("\nIt was found a input to this tick=" + tickToRewind);
                        }

                        // Get the old world state referent to the current tick to do the replay
                        const oldWorldStateToRewind = this.simulations_buffer_map_old[bufferToRewind];
                        applog("\nWorld state to do the rewind=" + JSON.stringify(oldWorldStateToRewind));

                        if (!oldWorldStateToRewind || oldWorldStateToRewind.tick != tickToRewind) {
                            applog("\nWas not found a world state to rewind the tick=" + tickToRewind);
                            break;
                        }

                        // Again, I don't want to change any value throught reference
                        const oldWorldStateToRewindCopy = this.copyWorldState(oldWorldStateToRewind);

                        for (let p in connectedPlayers) {
                            applog2("\ntick (oldWorldStateToRewindCopy)=" + oldWorldStateToRewindCopy.tick + " Old position before rewind=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                        }

                        // Process the inputs
                        const rewindedWorldState = this.processMultipleInputs(inputsToRewind, oldWorldStateToRewindCopy, deltaTime, "rewind");

                        if (this.isWorldStateValid(rewindedWorldState)) {
                            // Update the world
                            // I'm going to do that because the updates must affect the current world and the replay and rewind must go
                            // until the current world state
                            this.setConnectedPlayer(this.copyPlayers(rewindedWorldState.players));
                            this.setBullets(rewindedWorldState.bullets);

                            for (let p in connectedPlayers) {
                                applog2("\ntick (rewindedWorldState)=" + rewindedWorldState.tick + " New position after rewind=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                            }
                            // Update the next old world state, since it is the new state of it
                            // Increase the tick to storage at the next buffer
                            rewindedWorldState.tick++;
                            const nBuffer = rewindedWorldState.tick % BUFFER_SIZE;
                            this.simulations_buffer_map_old[nBuffer] = rewindedWorldState;

                            applog("\nRewinded world state=" + JSON.stringify(rewindedWorldState));

                            // The app will calculate with the result of result of the tick, but using the POST list, same tick, but the result
                            const worldToSend = this.copyWorldState(rewindedWorldState);
                            worldToSend.tick -= 1;
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
                    applog("\nThe tick=" + inputsTick + " seems to be too old and there isn't any world state storaged to do the replay\n world state got=" + JSON.stringify(oldWorldStateToReplay));
                }
            } else {
                // Save the inputs used, this way I can use these inputs to do the replay and rewind later
                this.inputs_buffer_map_old_secondary[buffer] = this.copyInputs(inputs);

                // Create the current world state to save it
                const worldState = {
                    tick: this.server_tick_number,
                    players: this.getConnectedPlayers(),
                    bullets: this.getBullets(),
                }

                // Copy the values to guarantee that the reference won't be duplicated
                const copyWorldState = this.copyWorldState(worldState);

                applog("\nCurrent world state=" + JSON.stringify(copyWorldState));

                // Save the world state, this way I can use different inputs in this state and generate new worlds
                this.simulations_buffer_map_old[buffer] = copyWorldState;

                for (let p in connectedPlayers) {
                    applog("\ntick (normal)=" + this.server_tick_number + " Old position before normal=" + connectedPlayers[p].id + " " + JSON.stringify(connectedPlayers[p].playerMovement));
                }
                // Process the current inputs
                const newWorldState = this.processMultipleInputs(inputs, this.copyWorldState(copyWorldState), deltaTime, "normal");

                if (this.isWorldStateValid(newWorldState)) {
                    // Update the world with the new values, copying that to guarantee the reference safety
                    this.setConnectedPlayer(this.copyPlayers(newWorldState.players));
                    this.setBullets(newWorldState.bullets);

                    this.printWorldStatePositions(newWorldState, "normal")

                    // Save the world to be sent
                    for (var i in inputs) {
                        this.saveTheUpdatedWorldStateToSent(newWorldState, inputs[i]);
                    }

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
        const oldInputs = this.inputs_buffer_map_old_secondary[buffer];

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

    // handleTickDefault() {
    //     while (this.server_input_msgs.length > 0) { //  && Time.time >= this.server_input_msgs.Peek().delivery_time
    //         const input_msg = this.server_input_msgs.dequeue();
    //         // applog("\nserver tick " + this.server_tick_number + " start tick from client " + input_msg.start_tick_number);

    //         // message contains an array of inputs, calculate what tick the final one is
    //         const max_tick = input_msg.start_tick_number + input_msg.inputs.length - 1;

    //         // applog("\nthis.server_tick_number=" + this.server_tick_number + " max_tick=" + max_tick);
    //         // if that tick is greater than or equal to the current tick we're on, then it
    //         // has inputs which are new
    //         if (max_tick >= this.server_tick_number) {
    //             // there may be some inputs in the array that we've already had,
    //             // so figure out where to start
    //             const start_i = this.server_tick_number > input_msg.start_tick_number ? (this.server_tick_number - input_msg.start_tick_number) : 0;

    //             // applog("\nstart_i=" + start_i + " input_msg.inputs.length=" + input_msg.inputs.length);
    //             // run through all relevant inputs, and step player forward
    //             // applog("\nTick=" + input_msg.start_tick_number + " size=" + input_msg.inputs.length)
    //             for (var i = start_i; i < input_msg.inputs.length; ++i) {
    //                 // applog("\ni=" + i + " tick=" + input_msg.start_tick_number + " size=" + input_msg.inputs.length);
    //                 const packageToSend = this.processInputs(input_msg.inputs[i], deltaTime);

    //                 this.server_tick_number++;
    //                 // applog("\nserver_tick_number=" + server_tick_number)
    //                 this.server_tick_accumulator++;
    //                 if (packageToSend && this.server_tick_accumulator >= this.server_snapshot_rate) {
    //                     this.server_tick_accumulator = 0;

    //                     packageToSend.tick = this.server_tick_number;

    //                     // if (packageToSend.bullets.length > 0) {
    //                     //     applog(packageToSend.tick);
    //                     // }

    //                     this.server_responses_queue.enqueue(packageToSend);
    //                 }
    //             }
    //         }
    //     }
    // }

    processInputs(inputs, worldState, delta) {
        applog("\nprocessInputs=" + JSON.stringify(inputs));
        if (!inputs) return;

        const playerIndex = worldState.players.findIndex(player => player.id == inputs.playerId);
        const player = worldState.players[playerIndex];

        applog("\nplayer to process=" + JSON.stringify(player));

        if (player) {
            const playerMovementInputsState = inputs.playerInputsState.playerMovementInputsState;
            const playerAimInputsState = inputs.playerInputsState.playerAimInputsState;
            const playerGunInputsState = inputs.playerInputsState.playerGunInputsState;

            player.playerMovement.angle = playerMovementInputsState.angle;
            player.playerMovement.strength = playerMovementInputsState.strength;
            player.setPosition(
                playerMovementController.calculateNewPosition(
                    player.id,
                    "from",
                    this.server_tick_number,
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
            // if (worldState.bulletInputsState.length > 0) {
            //     applog("\nTry to shoot");
            // }
            if (playerGunInputsState && inputs.bulletInputsState.length > 0 && player.canShoot()) {
                // applog("\nshooting");
                const localBullet = inputs.bulletInputsState[0]
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

            // Update world state with the updated values
            worldState.players[playerIndex] = player;
        }

        const packgeState = {
            tick: worldState.tick,
            players: worldState.players,
            bullets: worldState.bullets,
        }

        // if (this.getBullets().length > 0)
        //     applog(this.getBullets())

        return packgeState;
    }

    processMultipleInputs(inputList, worldState, delta, from, tick) {
        this.printWorldStatePositions(worldState, "processMultipleInputs");

        if (!inputList || !worldState) return;

        for (let index in inputList) {
            const payload = inputList[index];
            applog2("\ntick (payload)= " + tick + " payload to process in multiple=" + JSON.stringify(payload));

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
        // applog("\nonPlayerUpdated this.server_tick_number=" + this.server_tick_number);
        applog("\nid=" + id + " server tick=" + this.server_tick_number + " payload=" + payload);
        applog("\npayload=" + payload);
        const data = JSON.parse(payload);
        // this.server_input_msgs.enqueue(data);
        // TODO: if the hashmap works, I'll send them instead of create it here
        applog("\ndata.start_tick_number=" + data.start_tick_number);
        for (var i in data.inputs) {
            // applog(data.inputs[i]);
            this.client_inputs_map_current.put(data.inputs[i].tick, data.inputs[i]);
            applog("\ntick=" + data.inputs[i].tick + " player=" + data.inputs[i].playerId + " inputs=" + JSON.stringify(data.inputs[i].playerInputsState));
            // this.inputs_buffer_map_old.put(data.inputs[i].tick, data.inputs[i])

            // this.registerOldInputs(data.inputs[i]);
            // this.inputs_buffer_map_old.put(data.inputs[i].tick, data.inputs[i])
        }

        this.client_inputs_map_current.keys.sort((a, b) => a - b);

        applog("\nOrdering this.client_inputs_map_current=" + JSON.stringify(this.client_inputs_map_current));

        // applog("\nonPlayerUpdated");
        // this.inputs_buffer.print();
    }

    registerOldInputs(payload) {
        // Get the current buffer, when tick is 10 and BUFFER is 10, the result will be 0, 11 -> 1, 12 -> 2
        const buffer = payload.tick % BUFFER_SIZE;
        applog("\nregisterOldInputs buffer=" + buffer, "input to register=" + JSON.stringify(payload));

        // Get the elements saved
        const elements = this.inputs_buffer_map_old[buffer];

        applog("\nelements on buffer=" + JSON.stringify(elements));

        // Check if the there is elements 
        if (elements && elements.length > 0 && elements[0].tick == payload.tick) {

            applog("\nsame tick=" + payload.tick);

            // Check if one of the elements/inputs is from the same player
            // If it is, I'll replace the old value with the new one
            var found = false;
            for (let i in elements) {
                applog("\nelement=" + elements[i].playerId);
                if (elements[i].playerId == payload.playerId) {
                    elements[i] = payload;
                    found = true;
                    applog("\nThis player already was saved, so replace the value instead of push");
                    break;
                }
            }

            // If the player wasn't found, push the payload
            if (!found) {
                applog("\nPushing payload");
                elements.push(payload);
            }

            // Save the new elements
            this.inputs_buffer_map_old[buffer] = elements;
            applog("\nelements.inputs.length=" + elements.length + " value=" + JSON.stringify(this.inputs_buffer_map_old[buffer]));
        } else {
            // Create a new element with the payload
            applog("\nCreating a new buffer at tick=" + payload.tick);
            const newElements = [payload];

            // Save the element
            this.inputs_buffer_map_old[buffer] = newElements;
            applog("\nelements.inputs.length=" + newElements.length + " value=" + JSON.stringify(this.inputs_buffer_map_old[buffer]));
        }
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
            applog2("\n- Setting on tick=" + tick + " the players= " + players[p].id + " " + JSON.stringify(players[p].playerMovement));
        }
        connectedPlayers = players;
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

        // + " players " + JSON.stringify(this.getConnectedPlayers())
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
    // console.log(value);
    loggerList += "\n" + value;
}

function applog2(value) {
    loggerList += "\n" + value;
}

function saveFile() {
    fs.writeFile("D:\\Rittmann\\Projetos\\games\\simple card multiplayer game - server\\server\\log.txt", loggerList, function(err) {
        if (err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });
}