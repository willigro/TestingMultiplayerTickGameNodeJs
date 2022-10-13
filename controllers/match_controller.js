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
/**
 * Coneected players
 */
var connectedPlayers = [];

var bullets = [];

const playerMovementController = new PlayerMovementController();
const playerShootingController = new PlayerShootingController();

const FPS = 5;
const MAX_FPS_DELAY = 1000 / FPS; // rollback to 30 FPS

// TODO move it
const PLAYER_VELOCITY = 300.0

// KEEP IT EQUALS TO THE APP
const SERVER_TICK_RATE = 4;
const COUNT_TO_SEND = 2;
var timer = 0;
var minTimeBetweenTicks = 1 / SERVER_TICK_RATE;
var countToSend = 0;

var deltaTime = 0.0;

const BUFFER_SIZE = 5;

class MatchController {

    constructor(updateWorldState) {
        this.intervalGameLoop = null;
        this.updateWorldState = updateWorldState;

        this.now = Date.now();
        this.lastUpdate = Date.now();

        this.initServerValues();
    }

    initServerValues() {
        applog("initServerValues");
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
        this.simulations_buffer_map_old = new Queue(BUFFER_SIZE);
        this.world_state_response = [];
    }

    initGame() {
        applog("Game started");
        this.initGameLoop();
    }

    initGameLoop() {
        this.intervalGameLoop = setInterval(function() {
            this.tickDeltaTime();
            this.handleTick();

            for (var i = 0; i < this.getBullets().length; i++) {
                const bullet = this.getBullets()[i];
                if (bullet.isMoving(deltaTime)) {
                    // applog("Moving bullet, new size: " + this.getBullets().length);
                    playerShootingController.calculateNewBulletPosition(bullet, deltaTime);
                } else {
                    // applog("Removing bullet, new size: " + this.getBullets().length);
                    this.getBullets().splice(i, 1);
                }
            }

            // applog("countToSend=" + countToSend + " COUNT_TO_SEND=" + COUNT_TO_SEND + " this.world_state_response.length=" + this.world_state_response.length);
            timer += deltaTime;
            if (countToSend >= COUNT_TO_SEND) {
                timer = 0;
                countToSend = 0;

                if (this.world_state_response.length > 0) {
                    // Sort the response by tick
                    this.world_state_response.sort((a, b) => a.tick - b.tick);
                    // applog("Reponse=" + JSON.stringify(this.world_state_response));

                    console.log("\nsendint at tick=" + this.server_tick_number); // + " value=" + JSON.stringify(this.world_state_response)
                    for (let i in this.world_state_response) {
                        console.log("tick=" + this.world_state_response[i].tick + " value=" + JSON.stringify(this.world_state_response[i]));
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
    //     // applog("before size=" + this.map.map.size + " isNotEmpty=" + this.map.isNotEmpty());
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
    //     // applog("after size=" + this.map.map.size);
    // }

    handleTick() {
        // Run throught all new received inputs and get their keys, using 
        for (var k in this.client_inputs_map_current.keys) {

            // Get the current key, the keys are the TICK
            const key = this.client_inputs_map_current.keys[k];
            applog("\nCurrent tick=" + this.server_tick_number + " handling key=" + key);

            // Get the message/inputs referent to the current key/tick
            const inputsByTick = this.client_inputs_map_current.get(key);
            applog("Inputs to this key size=" + inputsByTick.length);

            var canIncreaseTick = false;

            // Read all the inputs of the tick
            for (var iT in inputsByTick) {

                // Current inputs
                const inputs = inputsByTick[iT];

                // Get the buffer referent to the input's tick, if the buffer_size is 10 and the tick is 
                // 11, the result will be 1
                const buffer = inputs.tick % BUFFER_SIZE;
                applog("\nhandle tick buffer=" + buffer + " inputs=" + JSON.stringify(inputs));

                // Get the old inputs referent to this buffer, It will not guarantee that the inputs are
                // referent to the current tick, so I'll need to confirme it
                const oldInputsOnBuffer = this.inputs_buffer_map_old[buffer];

                applog("oldInputsOnBuffer=" + JSON.stringify(oldInputsOnBuffer));
                if (inputs.tick < this.server_tick_number ||
                    (oldInputsOnBuffer && oldInputsOnBuffer.length > 0 && oldInputsOnBuffer[0].tick == inputs.tick)) {

                    // If already exists an inputs equals to the new one, I can ignore it
                    // Since it was find at the same tick it means that it was sent duplicated
                    // I cannot handle something like goes to the same position twice at the same tick!
                    if (this.isInputDuplicated(oldInputsOnBuffer, inputs)) {
                        applog("Ignore the current input cause it is duplicated");
                        continue;
                    }

                    applog("The inputs tick was already added");

                    // Add the new inputs to the old ones and save it
                    this.registerOldInputs(inputs);

                    // Get the inputs again after the register, because it could be overrided
                    const oldInputs = this.inputs_buffer_map_old[buffer];
                    applog("oldInputs (confirming the inputs selected)=" + JSON.stringify(oldInputs));

                    // Get the old world state, I'll use it to make the replay
                    const oldWorldState = this.simulations_buffer_map_old[buffer];

                    applog("\nOld world state to replay=" + JSON.stringify(oldWorldState));

                    // Process the inputs doing a replay
                    const replayedWorldState = this.processInputsDoingReplay(oldInputs, this.copyWorldState(oldWorldState), deltaTime);
                    console.log("\nReplayed world state=" + JSON.stringify(replayedWorldState));

                    if (replayedWorldState) {
                        // Set the connected players and the bullets with the "new" state
                        this.setConnectedPlayer(this.copyPlayers(replayedWorldState.players));
                        this.setBullets(replayedWorldState.bullets);

                        // // Save the replayed world state
                        // this.simulations_buffer_map_old[buffer] = replayedWorldState

                        // Save the world to be sent
                        // replayedWorldState.tick = replayedWorldState.tick + 1;
                        applog("\nReplayed world state after adjust=" + JSON.stringify(replayedWorldState));
                        applog("\nOld world state after replay (on buffer)=" + JSON.stringify(this.simulations_buffer_map_old[buffer]));
                        this.saveTheWorldStateToSent(replayedWorldState);

                        // Rewind the world state until the current tick on server
                        applog("server tick=" + this.server_tick_number + " current tick=" + inputs.tick);

                        // Starting on the next tick, rewind the world
                        var replayAndRewindTick = inputs.tick + 1;
                        while (replayAndRewindTick < this.server_tick_number) {
                            applog("\nReplay and Rewind=" + replayAndRewindTick);
                            const rrBuffer = replayAndRewindTick % BUFFER_SIZE;

                            // Get the inputs
                            const oldInputs = this.inputs_buffer_map_old[rrBuffer];

                            // Build the current world state
                            const currentWorldState = {
                                tick: replayAndRewindTick,
                                players: this.getConnectedPlayers(),
                                bullets: this.getBullets(),
                            }

                            const copyCurrentWorldState = this.copyWorldState(currentWorldState)

                            applog("Current world state to rewind=" + JSON.stringify(copyCurrentWorldState));

                            // // Save the current world state
                            // this.simulations_buffer_map_old[rrBuffer] = copyCurrentWorldState;

                            // Get the old world state, I'll use it to make the replay
                            // const oldWorldState = this.simulations_buffer_map_old[rrBuffer];

                            // Process the inputs doing a replay and using the new current world state
                            // I'm doing it because the world could be changed after the replay
                            const rewindedWorldState = this.processInputsDoingReplay(oldInputs, copyCurrentWorldState, deltaTime);

                            if (rewindedWorldState) {
                                // Set the connected players and the bullets with the "new" state
                                this.setConnectedPlayer(this.copyPlayers(rewindedWorldState.players));
                                this.setBullets(rewindedWorldState.bullets);

                                console.log("Rewinded world state=" + JSON.stringify(rewindedWorldState));

                                // Save the world to be sent
                                // rewindedWorldState.tick = rewindedWorldState.tick + 1;
                                applog("\nRewinded world state after adjust=" + JSON.stringify(rewindedWorldState));
                                this.saveTheWorldStateToSent(rewindedWorldState);

                                // Save the replayed world state
                                // this.simulations_buffer_map_old[rrBuffer] = replayedWorldState

                                // Rewind the world state until the current tick on server
                                applog("server tick=" + this.server_tick_number + " current tick=" + replayAndRewindTick);
                            }

                            replayAndRewindTick++;
                        }
                    }
                } else {
                    // Increase the server tick cause a new state will be created
                    // this.server_tick_number++;

                    applog("The inputs was NOT added the the list");

                    // Register this inputs
                    this.registerOldInputs(inputs);

                    // Save the world state, this way I can use different inputs in this state and generate new worlds
                    const worldState = {
                        tick: this.server_tick_number,
                        players: this.getConnectedPlayers(),
                        bullets: this.getBullets(),
                    }

                    const copyWorldState = this.copyWorldState(worldState);

                    applog("Current world state=" + JSON.stringify(copyWorldState));

                    this.simulations_buffer_map_old[buffer] = copyWorldState;

                    // Process the current inputs
                    const newWorldState = this.processInputs(inputs, this.copyWorldState(copyWorldState), deltaTime);

                    // Update the world
                    this.setConnectedPlayer(this.copyPlayers(newWorldState.players));
                    this.setBullets(newWorldState.bullets);

                    applog("New world state=" + JSON.stringify(newWorldState));
                    applog("New world state 2=" + JSON.stringify(copyWorldState));

                    // remove it
                    const worldStateAfterEvaluate = {
                        tick: this.server_tick_number,
                        players: this.getConnectedPlayers(),
                        bullets: this.getBullets(),
                    }

                    applog("New world state 3 (after evaluate)=" + JSON.stringify(worldStateAfterEvaluate));

                    // Save the world to be sent
                    this.saveTheWorldStateToSent(newWorldState);

                    // Save the new world state
                    // this.simulations_buffer_map_old[buffer] = worldState;

                    canIncreaseTick = true;
                }
            }

            if (canIncreaseTick) {
                this.server_tick_number++;
            }
            applog("New tick=" + this.server_tick_number);
        }

        this.client_inputs_map_current.clear();
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

    saveTheWorldStateToSent(worldState) {
        // I don't want to send more then 1 state per tick
        var canAdd = true
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
    //         // applog("server tick " + this.server_tick_number + " start tick from client " + input_msg.start_tick_number);

    //         // message contains an array of inputs, calculate what tick the final one is
    //         const max_tick = input_msg.start_tick_number + input_msg.inputs.length - 1;

    //         // applog("this.server_tick_number=" + this.server_tick_number + " max_tick=" + max_tick);
    //         // if that tick is greater than or equal to the current tick we're on, then it
    //         // has inputs which are new
    //         if (max_tick >= this.server_tick_number) {
    //             // there may be some inputs in the array that we've already had,
    //             // so figure out where to start
    //             const start_i = this.server_tick_number > input_msg.start_tick_number ? (this.server_tick_number - input_msg.start_tick_number) : 0;

    //             // applog("start_i=" + start_i + " input_msg.inputs.length=" + input_msg.inputs.length);
    //             // run through all relevant inputs, and step player forward
    //             // applog("Tick=" + input_msg.start_tick_number + " size=" + input_msg.inputs.length)
    //             for (var i = start_i; i < input_msg.inputs.length; ++i) {
    //                 // applog("i=" + i + " tick=" + input_msg.start_tick_number + " size=" + input_msg.inputs.length);
    //                 const packageToSend = this.processInputs(input_msg.inputs[i], deltaTime);

    //                 this.server_tick_number++;
    //                 // applog("server_tick_number=" + server_tick_number)
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

        applog("player to process=" + JSON.stringify(player));

        if (player) {
            const playerMovementInputsState = inputs.playerInputsState.playerMovementInputsState;
            const playerAimInputsState = inputs.playerInputsState.playerAimInputsState;
            const playerGunInputsState = inputs.playerInputsState.playerGunInputsState;

            player.playerMovement.angle = playerMovementInputsState.angle;
            player.playerMovement.strength = playerMovementInputsState.strength;
            player.setPosition(
                playerMovementController.calculateNewPosition(
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
            //     applog("Try to shoot");
            // }
            if (playerGunInputsState && inputs.bulletInputsState.length > 0 && player.canShoot()) {
                // applog("shooting");
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

    processInputsDoingReplay(inputList, worldState, delta) {
        applog("\nprocessInputsDoingReplay World state=" + JSON.stringify(worldState));

        if (!inputList || !worldState) return;

        for (let index in inputList) {
            const payload = inputList[index];
            applog("\npayload to replay=" + JSON.stringify(payload));

            const playerIndex = worldState.players.findIndex(player => player.id == payload.playerId);
            const player = worldState.players[playerIndex];

            applog("player to replay=" + JSON.stringify(player));

            if (player) {
                const playerMovementInputsState = payload.playerInputsState.playerMovementInputsState;
                const playerAimInputsState = payload.playerInputsState.playerAimInputsState;
                const playerGunInputsState = payload.playerInputsState.playerGunInputsState;

                player.playerMovement.angle = playerMovementInputsState.angle;
                player.playerMovement.strength = playerMovementInputsState.strength;
                player.setPosition(
                    playerMovementController.calculateNewPosition(
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
                //     applog("Try to shoot");
                // }
                // if (playerGunInputsState && payload.bulletInputsState.length > 0 && player.canShoot()) {
                //     // applog("shooting");
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

    /**
     * It will handle only the send data, so I don't need to wait for more than one player
     */
    onPlayerUpdated(id, payload) {
        // applog("\nonPlayerUpdated this.server_tick_number=" + this.server_tick_number);
        console.log("\nid=" + id + " server tick=" + this.server_tick_number + " payload=" + payload);
        applog("\npayload=" + payload);
        const data = JSON.parse(payload);
        // this.server_input_msgs.enqueue(data);
        // TODO: if the hashmap works, I'll send them instead of create it here
        applog("data.start_tick_number=" + data.start_tick_number);
        for (var i in data.inputs) {
            // applog(data.inputs[i]);
            this.client_inputs_map_current.put(data.inputs[i].tick, data.inputs[i]);
            applog("tick=" + data.inputs[i].tick + " player=" + data.inputs[i].playerId + " inputs=" + JSON.stringify(data.inputs[i].playerInputsState));
            // this.inputs_buffer_map_old.put(data.inputs[i].tick, data.inputs[i])

            // this.registerOldInputs(data.inputs[i]);
            // this.inputs_buffer_map_old.put(data.inputs[i].tick, data.inputs[i])
        }

        this.client_inputs_map_current.keys.sort((a, b) => a - b);

        applog("Ordering this.client_inputs_map_current=" + JSON.stringify(this.client_inputs_map_current));

        // applog("onPlayerUpdated");
        // this.inputs_buffer.print();
    }

    registerOldInputs(payload) {
        // Get the current buffer, when tick is 10 and BUFFER is 10, the result will be 0, 11 -> 1, 12 -> 2
        const buffer = payload.tick % BUFFER_SIZE;
        applog("\nregisterOldInputs buffer=" + buffer, "input to register=" + JSON.stringify(payload));

        // Get the elements saved
        const elements = this.inputs_buffer_map_old[buffer];

        applog("elements on buffer=" + JSON.stringify(elements));

        // Check if the there is elements 
        if (elements && elements.length > 0 && elements[0].tick == payload.tick) {

            applog("same tick=" + payload.tick);

            // Check if one of the elements/inputs is from the same player
            // If it is, I'll replace the old value with the new one
            var found = false;
            for (let i in elements) {
                applog("element=" + elements[i].playerId);
                if (elements[i].playerId == payload.playerId) {
                    elements[i] = payload;
                    found = true;
                    applog("This player already was saved, so replace the value instead of push");
                    break;
                }
            }

            // If the player wasn't found, push the payload
            if (!found) {
                applog("Pushing payload");
                elements.push(payload);
            }

            // Save the new elements
            this.inputs_buffer_map_old[buffer] = elements;
            applog("elements.inputs.length=" + elements.length + " value=" + JSON.stringify(this.inputs_buffer_map_old[buffer]));
        } else {
            // Create a new element with the payload
            applog("Creating a new buffer at tick=" + payload.tick);
            const newElements = [payload];

            // Save the element
            this.inputs_buffer_map_old[buffer] = newElements;
            applog("elements.inputs.length=" + newElements.length + " value=" + JSON.stringify(this.inputs_buffer_map_old[buffer]));
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

    setConnectedPlayer(players) {
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

        applog("User connected! " + socket.id);

        return { newPlayer: newPlayer, players: this.getConnectedPlayers(), tick: this.server_tick_number };
    }

    removePlayer(socket) {
        const index = this.getConnectedPlayers().findIndex(player => player.id == socket.id);

        if (index > -1) {
            this.getConnectedPlayers().splice(index, 1);
        }

        if (this.getConnectedPlayers().length == 0) {
            applog("clear interval")
            clearInterval(this.intervalGameLoop);
        }

        // + " players " + JSON.stringify(this.getConnectedPlayers())
        applog("Player Disconnected! id=" + socket.id + " Remove index " + index);
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
}