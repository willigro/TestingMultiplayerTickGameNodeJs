 class PlayerMovementResult {
     constructor(socketId, playerMovement, playerAim) {
         this.id = socketId;
         this.playerMovement = playerMovement;
         this.playerAim = playerAim;
     }
 }

 module.exports = {
     PlayerMovementResult,
 };