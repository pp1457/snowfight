# Server
## Ideas
1. Some threads have uWS::app with three functons
    * .ws: Defines WebSocket behavior
    * ws->send(meesage, opCode): Send a message to client
    * ws->close(): Close the WebSocket connection
2. Some threads are responsible for game logic 
    * 
3. Each has three main function to implement
    * .open: Called when a WebSocket connection is opened
    * .message: Called when a message is received
    * .close: when a WebSocket connection is closed
## Events
1. Player movement
2. Snowball movement / emmission
3. Player be hitten by the snowball
    * Health reduce
    * Player die -> Experience increase -> Update scoreboard
## Implemetation
1. .message 
    

